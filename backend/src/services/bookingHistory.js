// One definition of "which bookings does this owner's history include" used by BOTH the history
// list (paginated) and the CSV export (everything), so the two can never disagree again.
//
// Semantics (documented decisions):
//  * Dates are the scheduled visit date `slot_date` (IST calendar date), never created_at/updated_at.
//  * No date filter = the complete history. `date` = one day, `from`/`to` = inclusive range.
//  * Status is the explicit booking status; it is never inferred from the date.
//  * Order: newest visit first, with id as a tie-breaker so paging is stable. A single-day view
//    is listed in time order (earliest slot first).
const { istNow } = require('./slotSchedule');

const STATUSES = ['pending', 'confirmed', 'arrived', 'no_show', 'cancelled', 'rejected'];
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const EXPORT_CHUNK = 500; // PostgREST silently caps a single response (default 1000): export pages through

class HistoryError extends Error {
  constructor(code, message) {
    super(message);
    this.status = 400;
    this.code = code;
  }
}

const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

function parseHistoryQuery(q = {}, now = new Date()) {
  const f = { from: null, to: null, statuses: null, limit: DEFAULT_LIMIT, offset: 0, ascending: false };

  if (q.date !== undefined && q.date !== '') {
    const day = String(q.date).slice(0, 10); // tolerate "YYYY-MM-DDTHH:MM:SS"
    if (!isDate(day)) throw new HistoryError('INVALID_DATE', 'date must be YYYY-MM-DD');
    f.from = day;
    f.to = day;
    f.ascending = true;
  }
  if (q.from) {
    if (!isDate(String(q.from))) throw new HistoryError('INVALID_DATE', 'from must be YYYY-MM-DD');
    f.from = String(q.from);
  }
  if (q.to) {
    if (!isDate(String(q.to))) throw new HistoryError('INVALID_DATE', 'to must be YYYY-MM-DD');
    f.to = String(q.to);
  }
  if (f.from && f.to && f.from > f.to) throw new HistoryError('INVALID_RANGE', 'from must not be after to');

  if (q.status) {
    const list = String(q.status).split(',').map((s) => s.trim()).filter(Boolean);
    const bad = list.find((s) => !STATUSES.includes(s));
    if (bad) throw new HistoryError('INVALID_STATUS', `Unknown status "${bad}"`);
    f.statuses = [...new Set(list)];
  }

  if (q.limit !== undefined) {
    const n = parseInt(q.limit, 10);
    if (!Number.isFinite(n) || n < 1) throw new HistoryError('INVALID_LIMIT', 'limit must be a positive number');
    f.limit = Math.min(n, MAX_LIMIT);
  }
  if (q.offset !== undefined) {
    const n = parseInt(q.offset, 10);
    if (!Number.isFinite(n) || n < 0) throw new HistoryError('INVALID_OFFSET', 'offset must be 0 or more');
    f.offset = n;
  }
  f.today = istNow(now).date;
  return f;
}

const COLUMNS = 'id, pump_id, user_id, slot_id, slot_date, slot_start, slot_end, status, booking_fee, amount_paid_now, pending_amount, fuel_payment_method, cancellation_reason, created_at, updated_at';

function applyFilter(query, pumpIds, f) {
  let q = query.in('pump_id', pumpIds);
  if (f.from) q = q.gte('slot_date', f.from);
  if (f.to) q = q.lte('slot_date', f.to);
  if (f.statuses) q = q.in('status', f.statuses);
  return q
    .order('slot_date', { ascending: f.ascending })
    .order('slot_start', { ascending: f.ascending })
    .order('id', { ascending: f.ascending });
}

async function attachPeople(supabase, rows, pumps) {
  const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
  let usersById = {};
  if (userIds.length) {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, phone, vehicle_number, vehicle_type')
      .in('id', userIds);
    if (error) throw error;
    usersById = Object.fromEntries((data || []).map((u) => [u.id, u]));
  }
  const pumpById = Object.fromEntries(pumps.map((p) => [p.id, p]));
  return rows.map((r) => ({
    ...r,
    user: usersById[r.user_id] || null,
    pump: pumpById[r.pump_id] ? { id: r.pump_id, name: pumpById[r.pump_id].name } : null,
    slot: { start_time: r.slot_start, end_time: r.slot_end, date: r.slot_date },
  }));
}

/** One page for the app. */
async function historyPage({ supabase, pumps, filter }) {
  const pumpIds = pumps.map((p) => p.id);
  if (!pumpIds.length) return { items: [], total: 0, has_more: false, limit: filter.limit, offset: filter.offset };
  const { data, count, error } = await applyFilter(
    supabase.from('bookings').select(COLUMNS, { count: 'exact' }),
    pumpIds,
    filter
  ).range(filter.offset, filter.offset + filter.limit - 1);
  if (error) throw error;
  const items = await attachPeople(supabase, data || [], pumps);
  const total = count ?? items.length;
  return { items, total, has_more: filter.offset + items.length < total, limit: filter.limit, offset: filter.offset };
}

/** Every matching row for the CSV: pages internally so nothing is cut off by a server-side row cap. */
async function historyAll({ supabase, pumps, filter }) {
  const pumpIds = pumps.map((p) => p.id);
  const all = [];
  for (let offset = 0; ; offset += EXPORT_CHUNK) {
    const { data, error } = await applyFilter(supabase.from('bookings').select(COLUMNS), pumpIds, filter).range(offset, offset + EXPORT_CHUNK - 1);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < EXPORT_CHUNK) break;
  }
  return attachPeople(supabase, all, pumps);
}

function csvEscape(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const CSV_HEADER = ['Pump', 'Date', 'Slot Start', 'Slot End', 'Customer Name', 'Phone', 'Vehicle Number', 'Vehicle Type', 'Status', 'Booking Fee', 'Checked-in At'];

function toCsv(rows) {
  const body = rows.map((b) => [
    b.pump?.name || '',
    b.slot_date,
    String(b.slot_start || '').slice(0, 5),
    String(b.slot_end || '').slice(0, 5),
    b.user?.name || '',
    b.user?.phone || '',
    b.user?.vehicle_number || '',
    b.user?.vehicle_type || '',
    b.status,
    Number(b.booking_fee || 0).toFixed(2),
    b.status === 'arrived' ? b.updated_at : '',
  ]);
  return [CSV_HEADER, ...body].map((r) => r.map(csvEscape).join(',')).join('\n');
}

module.exports = { STATUSES, HistoryError, parseHistoryQuery, historyPage, historyAll, toCsv, csvEscape, CSV_HEADER, DEFAULT_LIMIT, MAX_LIMIT, EXPORT_CHUNK };
