const test = require('node:test');
const assert = require('node:assert/strict');
const { parseHistoryQuery, historyPage, historyAll, toCsv, HistoryError, EXPORT_CHUNK } = require('../src/services/bookingHistory');

// Minimal in-memory stand-in for the supabase-js query builder (eq/in/gte/lte/order/range/count).
function fakeSupabase(tables) {
  return {
    from(name) {
      const st = { filters: [], orders: [], range: null, count: false };
      const b = {
        select(_c, opts) { st.count = !!(opts && opts.count); return b; },
        in(col, vals) { st.filters.push((r) => vals.includes(r[col])); return b; },
        gte(col, v) { st.filters.push((r) => r[col] >= v); return b; },
        lte(col, v) { st.filters.push((r) => r[col] <= v); return b; },
        order(col, { ascending }) { st.orders.push([col, ascending]); return b; },
        range(a, z) { st.range = [a, z]; return b; },
        then(res, rej) {
          let rows = tables[name].filter((r) => st.filters.every((f) => f(r)));
          for (const [col, asc] of [...st.orders].reverse()) {
            rows = [...rows].sort((x, y) => (x[col] < y[col] ? -1 : x[col] > y[col] ? 1 : 0) * (asc ? 1 : -1));
          }
          const total = rows.length;
          if (st.range) rows = rows.slice(st.range[0], st.range[1] + 1);
          return Promise.resolve({ data: rows, count: st.count ? total : null, error: null }).then(res, rej);
        },
      };
      return b;
    },
  };
}

const pumps = [{ id: 'p1', name: 'Ghanshyampump' }];
const users = [{ id: 'u1', name: 'A', phone: '1', vehicle_number: 'MH1', vehicle_type: 'car' }];
const mk = (id, date, status, start = '10:00:00') => ({ id, pump_id: 'p1', user_id: 'u1', slot_date: date, slot_start: start, slot_end: '10:30:00', status, booking_fee: 50, updated_at: 'x' });
const rows = [
  mk('b1', '2026-10-23', 'arrived', '09:00:00'),
  mk('b2', '2026-10-23', 'cancelled', '10:00:00'),
  mk('b3', '2026-10-23', 'no_show', '23:30:00'),
  mk('b4', '2026-10-22', 'confirmed'),
  mk('b5', '2026-10-24', 'pending'),
  mk('b6', '2026-09-01', 'arrived'),
  { ...mk('x1', '2026-10-23', 'arrived'), pump_id: 'other' },
];
const db = () => fakeSupabase({ bookings: rows, users });
const run = (q, now) => parseHistoryQuery(q, now);

test("yesterday's bookings are included, other pumps are not", async () => {
  const f = run({ date: '2026-10-23' });
  const page = await historyPage({ supabase: db(), pumps, filter: f });
  assert.deepEqual(page.items.map((i) => i.id), ['b1', 'b2', 'b3']);
  assert.equal(page.total, 3);
});

test('no filter returns the complete history, newest first, including old completed', async () => {
  const page = await historyPage({ supabase: db(), pumps, filter: run({ limit: 100 }) });
  assert.deepEqual(page.items.map((i) => i.id), ['b5', 'b3', 'b2', 'b1', 'b4', 'b6']);
});

test('status filter keeps groups separate', async () => {
  const done = await historyPage({ supabase: db(), pumps, filter: run({ status: 'arrived' }) });
  assert.deepEqual(done.items.map((i) => i.id).sort(), ['b1', 'b6']);
  const canc = await historyPage({ supabase: db(), pumps, filter: run({ status: 'cancelled,rejected' }) });
  assert.deepEqual(canc.items.map((i) => i.id), ['b2']);
  const up = await historyPage({ supabase: db(), pumps, filter: run({ status: 'pending,confirmed' }) });
  assert.deepEqual(up.items.map((i) => i.id).sort(), ['b4', 'b5']);
});

test('midnight boundaries: a 23:30 slot stays on its own date, ranges are inclusive', async () => {
  const d23 = await historyPage({ supabase: db(), pumps, filter: run({ date: '2026-10-23' }) });
  assert.ok(d23.items.some((i) => i.id === 'b3'));
  const d24 = await historyPage({ supabase: db(), pumps, filter: run({ date: '2026-10-24' }) });
  assert.deepEqual(d24.items.map((i) => i.id), ['b5']);
  const rng = await historyPage({ supabase: db(), pumps, filter: run({ from: '2026-10-22', to: '2026-10-23' }) });
  assert.equal(rng.total, 4);
});

test('today is the IST date, not UTC', () => {
  // 2026-10-23 20:00 UTC is already 2026-10-24 01:30 in India
  assert.equal(run({}, new Date('2026-10-23T20:00:00Z')).today, '2026-10-24');
  assert.equal(run({}, new Date('2026-10-23T18:29:00Z')).today, '2026-10-23');
});

test('pagination walks every row exactly once', async () => {
  const seen = [];
  for (let offset = 0; ; offset += 2) {
    const page = await historyPage({ supabase: db(), pumps, filter: run({ limit: 2, offset }) });
    seen.push(...page.items.map((i) => i.id));
    if (!page.has_more) break;
  }
  assert.equal(seen.length, 6);
  assert.equal(new Set(seen).size, 6);
});

test('UI and export agree: same filter => same records (export is not capped by the page size)', async () => {
  for (const q of [{}, { date: '2026-10-23' }, { status: 'arrived' }, { from: '2026-10-22', to: '2026-10-24' }]) {
    const f = run(q);
    const all = await historyAll({ supabase: db(), pumps, filter: f });
    const ui = [];
    for (let offset = 0; ; offset += 2) {
      const page = await historyPage({ supabase: db(), pumps, filter: run({ ...q, limit: 2, offset }) });
      ui.push(...page.items);
      if (!page.has_more) break;
    }
    assert.deepEqual(all.map((r) => r.id), ui.map((r) => r.id));
  }
});

test('export pages past the server row cap', async () => {
  const many = Array.from({ length: EXPORT_CHUNK * 2 + 7 }, (_, i) => mk(`m${String(i).padStart(5, '0')}`, '2026-10-01', 'arrived'));
  const all = await historyAll({ supabase: fakeSupabase({ bookings: many, users }), pumps, filter: run({}) });
  assert.equal(all.length, many.length);
});

test('owner scope: a pump list without the booking pump yields nothing', async () => {
  const page = await historyPage({ supabase: db(), pumps: [{ id: 'nope', name: 'x' }], filter: run({}) });
  assert.equal(page.total, 0);
  const none = await historyPage({ supabase: db(), pumps: [], filter: run({}) });
  assert.deepEqual(none.items, []);
});

test('status change shows up on the next fetch', async () => {
  const local = rows.map((r) => ({ ...r }));
  const sb = fakeSupabase({ bookings: local, users });
  const before = await historyPage({ supabase: sb, pumps, filter: run({ status: 'arrived', date: '2026-10-22' }) });
  assert.equal(before.total, 0);
  local.find((r) => r.id === 'b4').status = 'arrived';
  const after = await historyPage({ supabase: sb, pumps, filter: run({ status: 'arrived', date: '2026-10-22' }) });
  assert.equal(after.total, 1);
});

test('invalid input is rejected with 400-class errors', () => {
  for (const q of [{ date: '2026-13-40' }, { date: 'abc' }, { from: '2026-10-24', to: '2026-10-01' }, { status: 'bogus' }, { limit: 0 }, { offset: -1 }]) {
    assert.throws(() => run(q), (e) => e instanceof HistoryError && e.status === 400);
  }
  assert.equal(run({ limit: 5000 }).limit, 100);
});

test('CSV has the same rows as the list and escapes values', async () => {
  const all = await historyAll({ supabase: db(), pumps, filter: run({ date: '2026-10-23' }) });
  const lines = toCsv(all).split('\n');
  assert.equal(lines.length, 4);
  assert.match(lines[0], /^Pump,Date,/);
  const tricky = toCsv([{ ...all[0], user: { name: 'A, "B"' } }]);
  assert.ok(tricky.includes('"A, ""B"""'));
});
