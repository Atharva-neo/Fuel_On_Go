// Pump operating schedule -> slot grid. Pure functions, no I/O.
//
// Conventions (documented decisions):
//  * Times are IST wall-clock "HH:MM". Midnight as a CLOSING time is "24:00";
//    "00:00" given as closing time is normalised to "24:00". "00:00"-"24:00" = round the clock.
//  * Overnight schedules ARE supported (e.g. 22:00-02:00). Slots are keyed by the
//    calendar date they occur on, so a day with an overnight schedule has two windows:
//    [00:00, close) (continuing last night's shift) and [open, 24:00). No slot ever
//    crosses midnight, so slot_date/start_time/end_time stay simple and bookings
//    keep one date.
//  * Slots are laid out from the start of each window in fixed steps of SLOT_DURATION_MINUTES
//    and stop before closing: a trailing gap shorter than one slot is not bookable.
//  * Duration: the app had two numbers (35 min in the old SQL generate_daily_slots, 30 min
//    in the owner's slot-time editor). 30 is used everywhere now; override with the
//    SLOT_DURATION_MINUTES env var.
const SLOT_DURATION_MINUTES = Math.max(5, Number(process.env.SLOT_DURATION_MINUTES) || 30);
const SLOT_HORIZON_DAYS = 7; // today + 6 more days are kept generated
const DAY = 1440;
const IST_OFFSET_MIN = 330;

function parseClock(value) {
  if (value === null || value === undefined) return null;
  const m = String(value).trim().match(/^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || (h === 24 && (min !== 0 || (m[3] && m[3] !== '00')))) return null;
  return h * 60 + min;
}

function formatClock(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function fail(code, message) {
  return { ok: false, code, message };
}

function normalizeSchedule(open, close, durationMin = SLOT_DURATION_MINUTES) {
  const o = parseClock(open);
  let c = parseClock(close);
  if (o === null || c === null) {
    return fail('INVALID_TIME', 'Opening and closing time must be valid times like 06:00 or 22:30 (use 24:00 for midnight).');
  }
  if (o >= DAY) return fail('INVALID_OPENING', 'Opening time cannot be 24:00. Use 00:00 to open at midnight.');
  if (c === 0 && o > 0) c = DAY; // "00:00" as a closing time means midnight
  if (o === c) {
    return fail('SAME_TIME', 'Opening and closing time are the same. For round-the-clock service use 00:00 to 24:00.');
  }

  const overnight = c < o;
  const windows = overnight
    ? [{ start: 0, end: c }, { start: o, end: DAY }]
    : [{ start: o, end: c }];
  const usable = windows.filter((w) => w.end - w.start >= durationMin);
  if (!usable.length) {
    return fail('TOO_SHORT', `Operating hours must allow at least one ${durationMin}-minute slot.`);
  }
  return {
    ok: true,
    open: formatClock(o),
    close: formatClock(c), // "24:00" for midnight
    openMin: o,
    closeMin: c,
    overnight,
    windows: usable,
    durationMin,
  };
}

/** Slot definitions for one calendar day. */
function generateSlotDefs(schedule, capacity, durationMin = schedule.durationMin) {
  const defs = [];
  for (const w of schedule.windows) {
    for (let start = w.start; start + durationMin <= w.end; start += durationMin) {
      defs.push({
        startMin: start,
        endMin: start + durationMin,
        start_time: `${formatClock(start)}:00`,
        end_time: `${formatClock(start + durationMin)}:00`,
        capacity,
      });
    }
  }
  return defs.sort((a, b) => a.startMin - b.startMin);
}

function slotMinutes(slot) {
  return { startMin: parseClock(slot.start_time), endMin: parseClock(slot.end_time) };
}

/** True when the slot lies completely inside one operating window. */
function withinWindows(schedule, startMin, endMin) {
  if (startMin === null || endMin === null || endMin <= startMin) return false;
  return schedule.windows.some((w) => startMin >= w.start && endMin <= w.end);
}

const overlaps = (a, b) => a.startMin < b.endMin && b.startMin < a.endMin;

// ─── IST date/time helpers (the server may run in UTC) ───
function istNow(now = new Date()) {
  const shifted = new Date(now.getTime() + IST_OFFSET_MIN * 60000);
  return {
    date: shifted.toISOString().slice(0, 10),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

function addDaysIso(dateIso, n) {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Absolute instant of a slot boundary; "24:00" is the next day's midnight. */
function slotInstant(dateIso, clock) {
  const minutes = parseClock(clock);
  if (minutes === null) return null;
  return new Date(new Date(`${dateIso}T00:00:00+05:30`).getTime() + minutes * 60000);
}

module.exports = {
  SLOT_DURATION_MINUTES,
  SLOT_HORIZON_DAYS,
  parseClock,
  formatClock,
  normalizeSchedule,
  generateSlotDefs,
  slotMinutes,
  withinWindows,
  overlaps,
  istNow,
  addDaysIso,
  slotInstant,
};
