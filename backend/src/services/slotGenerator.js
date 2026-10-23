// Slot generation/sync driven by the pump's SAVED operating schedule.
// One code path serves: pump registration, "Save Changes" on Edit Pump, the daily job,
// the owner's Manage Slots screen and the customer-facing availability list.
//
// store interface (Supabase in production, in-memory in tests):
//   listSlots(pumpId, date)        -> [{id, slot_date, start_time, end_time, capacity, booked_count, is_deactivated, deactivation_reason}]
//   slotIdsWithBookings(ids)       -> Set of slot ids that have ANY booking row (any status)
//   insertSlots(rows)              -> void  (must ignore duplicates on pump_id+slot_date+start_time)
//   deleteSlots(ids)               -> void
//   updateCapacity(id, capacity)   -> void
const {
  SLOT_DURATION_MINUTES,
  SLOT_HORIZON_DAYS,
  normalizeSchedule,
  generateSlotDefs,
  slotMinutes,
  withinWindows,
  overlaps,
  istNow,
  addDaysIso,
  slotInstant,
  parseClock,
} = require('./slotSchedule');

class ScheduleError extends Error {
  constructor(code, message) {
    super(message);
    this.status = 400;
    this.code = code;
  }
}

function scheduleOf(pump, durationMin = SLOT_DURATION_MINUTES) {
  const s = normalizeSchedule(pump.working_hours_start, pump.working_hours_end, durationMin);
  if (!s.ok) throw new ScheduleError(s.code, s.message);
  return s;
}

const capacityOf = (pump) => Math.max(1, Number(pump.vehicles_per_slot) || 5);

async function rebuildDate({ store, pump, date, schedule }) {
  const existing = await store.listSlots(pump.id, date);
  const withBookings = await store.slotIdsWithBookings(existing.map((s) => s.id));
  // Slots that have (or ever had) bookings are never deleted or moved.
  const deletable = existing.filter((s) => !(s.booked_count > 0) && !withBookings.has(s.id));
  const keptSlots = existing.filter((s) => !deletable.includes(s));
  const newCap = capacityOf(pump);

  if (deletable.length) await store.deleteSlots(deletable.map((s) => s.id));

  const carry = new Map(deletable.map((s) => [String(s.start_time).slice(0, 5), s]));
  const keptRanges = keptSlots.map(slotMinutes);
  const defs = generateSlotDefs(schedule, newCap).filter((d) => !keptRanges.some((k) => overlaps(d, k)));
  const rows = defs.map((d) => {
    const old = carry.get(d.start_time.slice(0, 5));
    return {
      pump_id: pump.id,
      slot_date: date,
      start_time: d.start_time,
      end_time: d.end_time,
      capacity: newCap,
      // a paused slot that lands on the same start time stays paused
      is_deactivated: !!old?.is_deactivated,
      deactivation_reason: old?.is_deactivated ? old.deactivation_reason || null : null,
    };
  });
  if (rows.length) await store.insertSlots(rows);

  // Booked slots we had to keep: capacity follows the pump setting but never drops below what is booked.
  let capacityUpdates = 0;
  for (const s of keptSlots) {
    const { startMin, endMin } = slotMinutes(s);
    if (!withinWindows(schedule, startMin, endMin)) continue;
    const target = Math.max(newCap, s.booked_count || 0);
    if (s.capacity !== target) {
      await store.updateCapacity(s.id, target);
      capacityUpdates += 1;
    }
  }
  return { created: rows.length, removed: deletable.length, kept: keptSlots.length, capacityUpdates };
}

async function fillDate({ store, pump, date, schedule }) {
  const existing = await store.listSlots(pump.id, date);
  const inWindow = existing.filter((s) => {
    const { startMin, endMin } = slotMinutes(s);
    return withinWindows(schedule, startMin, endMin);
  });

  if (inWindow.length) {
    // Heal untouched legacy data (e.g. the old 35-minute grid) when nothing on that day is booked.
    const legacy = inWindow.some((s) => {
      const { startMin, endMin } = slotMinutes(s);
      return endMin - startMin !== schedule.durationMin;
    });
    if (legacy && existing.every((s) => !(s.booked_count > 0))) {
      const withBookings = await store.slotIdsWithBookings(existing.map((s) => s.id));
      if (existing.every((s) => !withBookings.has(s.id))) {
        return rebuildDate({ store, pump, date, schedule });
      }
    }
    return { created: 0, removed: 0, kept: existing.length, capacityUpdates: 0 };
  }

  const ranges = existing.map(slotMinutes);
  const rows = generateSlotDefs(schedule, capacityOf(pump))
    .filter((d) => !ranges.some((r) => overlaps(d, r)))
    .map((d) => ({
      pump_id: pump.id,
      slot_date: date,
      start_time: d.start_time,
      end_time: d.end_time,
      capacity: d.capacity,
      is_deactivated: false,
      deactivation_reason: null,
    }));
  if (rows.length) await store.insertSlots(rows);
  return { created: rows.length, removed: 0, kept: existing.length, capacityUpdates: 0 };
}

/** Capacity-only change: apply to every slot in the window, never below what is booked. */
async function capacityDate({ store, pump, date, schedule }) {
  const existing = await store.listSlots(pump.id, date);
  const newCap = capacityOf(pump);
  let n = 0;
  for (const s of existing) {
    const { startMin, endMin } = slotMinutes(s);
    if (!withinWindows(schedule, startMin, endMin)) continue;
    const target = Math.max(newCap, s.booked_count || 0);
    if (s.capacity !== target) {
      await store.updateCapacity(s.id, target);
      n += 1;
    }
  }
  return { created: 0, removed: 0, kept: existing.length, capacityUpdates: n };
}

const sum = (a, b) => ({
  created: a.created + b.created,
  removed: a.removed + b.removed,
  kept: a.kept + b.kept,
  capacityUpdates: a.capacityUpdates + b.capacityUpdates,
});
const ZERO = { created: 0, removed: 0, kept: 0, capacityUpdates: 0 };

function horizonDates(today, days = SLOT_HORIZON_DAYS) {
  return Array.from({ length: days }, (_, i) => addDaysIso(today, i));
}

/** Keep today + the next days generated for a pump (idempotent; safe to run repeatedly). */
async function ensureUpcoming({ store, pump, now = new Date() }) {
  const schedule = scheduleOf(pump);
  let total = ZERO;
  for (const date of horizonDates(istNow(now).date)) {
    total = sum(total, await fillDate({ store, pump, date, schedule }));
  }
  return total;
}

/**
 * The owner saved new settings. `before` = hours/capacity prior to the save.
 *  - hours changed  -> rebuild the grid for every upcoming day (bookings kept)
 *  - only capacity  -> update capacities
 *  - then fill any missing days
 */
async function applyScheduleChange({ store, pump, before, now = new Date() }) {
  const schedule = scheduleOf(pump);
  const prev = before ? normalizeSchedule(before.working_hours_start, before.working_hours_end) : null;
  const hoursChanged = !prev || !prev.ok || prev.open !== schedule.open || prev.close !== schedule.close;
  const capChanged = !before || Number(before.vehicles_per_slot) !== Number(pump.vehicles_per_slot);

  let total = ZERO;
  for (const date of horizonDates(istNow(now).date)) {
    if (hoursChanged) total = sum(total, await rebuildDate({ store, pump, date, schedule }));
    else if (capChanged) total = sum(total, await capacityDate({ store, pump, date, schedule }));
    total = sum(total, await fillDate({ store, pump, date, schedule }));
  }
  return { ...total, hours_changed: hoursChanged, capacity_changed: capChanged, schedule: describe(schedule) };
}

function describe(schedule) {
  return {
    open: schedule.open,
    close: schedule.close,
    overnight: schedule.overnight,
    slot_duration_minutes: schedule.durationMin,
    windows: schedule.windows.map((w) => ({ start: w.start, end: w.end })),
  };
}

function statusOf(slot, now) {
  if (slot.is_deactivated) return 'deactivated';
  if ((slot.booked_count || 0) >= (slot.capacity || 0)) return 'full';
  const start = slotInstant(slot.slot_date, String(slot.start_time).slice(0, 8));
  if (start && start.getTime() < now.getTime()) return 'expired';
  return 'open';
}

/**
 * The single read path for slots. Owner (Manage Slots) and customers (booking) both call this,
 * so they always see the same list for the same saved schedule.
 */
async function getSlotsForDate({ store, pump, date, now = new Date() }) {
  const schedule = scheduleOf(pump);
  const today = istNow(now).date;
  if (date >= today && date <= addDaysIso(today, 60)) {
    await fillDate({ store, pump, date, schedule });
  }
  const rows = await store.listSlots(pump.id, date);
  const slots = rows
    .filter((s) => {
      const { startMin, endMin } = slotMinutes(s);
      return withinWindows(schedule, startMin, endMin);
    })
    .sort((a, b) => parseClock(a.start_time) - parseClock(b.start_time))
    .map((s) => {
      const status = statusOf(s, now);
      const capacity = s.capacity || 0;
      const booked = s.booked_count || 0;
      return { ...s, booked_count: booked, capacity, status, available: status === 'open' ? Math.max(0, capacity - booked) : 0 };
    });
  return { date, slots, schedule: describe(schedule) };
}

/** Is this slot bookable under the pump's CURRENT saved hours? (used by POST /bookings) */
function slotAllowedByHours(pump, slot) {
  const schedule = normalizeSchedule(pump.working_hours_start, pump.working_hours_end);
  if (!schedule.ok) return false;
  const { startMin, endMin } = slotMinutes(slot);
  return withinWindows(schedule, startMin, endMin);
}

/** Existing bookings that would fall outside a proposed schedule (they are never auto-cancelled). */
function bookingsOutside(schedule, bookings) {
  return bookings.filter((b) => {
    const startMin = parseClock(b.slot_start);
    const endMin = parseClock(b.slot_end);
    return !withinWindows(schedule, startMin, endMin);
  });
}

module.exports = {
  ScheduleError,
  scheduleOf,
  ensureUpcoming,
  applyScheduleChange,
  getSlotsForDate,
  slotAllowedByHours,
  bookingsOutside,
  rebuildDate,
  fillDate,
};
