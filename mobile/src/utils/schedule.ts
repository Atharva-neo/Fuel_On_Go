// Client-side mirror of backend/src/services/slotSchedule.js (same rules, same messages).
// The server is the authority and re-validates everything; this only gives owners instant,
// specific feedback and keeps date/period logic in one tested place.
// scripts/schedule.test.mjs checks both implementations against the same table of inputs.

const DAY = 1440;
export const SLOT_DURATION_MINUTES = 30;

export function parseClock(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const m = String(value).trim().match(/^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || (h === 24 && (min !== 0 || (m[3] && m[3] !== '00')))) return null;
  return h * 60 + min;
}

export function formatClock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export type ScheduleResult =
  | { ok: true; open: string; close: string; overnight: boolean; windows: Array<{ start: number; end: number }> }
  | { ok: false; code: string; message: string };

export function normalizeSchedule(open: unknown, close: unknown, durationMin = SLOT_DURATION_MINUTES): ScheduleResult {
  const o = parseClock(open);
  let c = parseClock(close);
  if (o === null || c === null) {
    return { ok: false, code: 'INVALID_TIME', message: 'Opening and closing time must be valid times like 06:00 or 22:30 (use 24:00 for midnight).' };
  }
  if (o >= DAY) return { ok: false, code: 'INVALID_OPENING', message: 'Opening time cannot be 24:00. Use 00:00 to open at midnight.' };
  if (c === 0 && o > 0) c = DAY;
  if (o === c) {
    return { ok: false, code: 'SAME_TIME', message: 'Opening and closing time are the same. For round-the-clock service use 00:00 to 24:00.' };
  }
  const overnight = c < o;
  const windows = (overnight ? [{ start: 0, end: c }, { start: o, end: DAY }] : [{ start: o, end: c }]).filter(
    (w) => w.end - w.start >= durationMin
  );
  if (!windows.length) {
    return { ok: false, code: 'TOO_SHORT', message: `Operating hours must allow at least one ${durationMin}-minute slot.` };
  }
  return { ok: true, open: formatClock(o), close: formatClock(c), overnight, windows };
}

// ---- IST dates (the app and the server both work in India Standard Time) ----
const IST_MS = 330 * 60000;

export function istDate(offsetDays = 0, now: Date = new Date()): string {
  const d = new Date(now.getTime() + IST_MS);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/** Absolute instant for a slot time on an IST date; "24:00" = next midnight. */
export function slotStartMs(dateIso: string, clock: string): number {
  const minutes = parseClock(clock);
  if (minutes === null) return NaN;
  return new Date(`${dateIso}T00:00:00+05:30`).getTime() + minutes * 60000;
}

// ---- customer slot list: every hour of the day is covered ----
export const PERIODS = [
  { key: 'late_night', label: 'Late night', icon: 'weather-night', range: '(12AM - 6AM)', from: 0, to: 6 },
  { key: 'morning', label: 'Morning', icon: 'weather-sunset-up', range: '(6AM - 12PM)', from: 6, to: 12 },
  { key: 'afternoon', label: 'Afternoon', icon: 'white-balance-sunny', range: '(12PM - 6PM)', from: 12, to: 18 },
  { key: 'evening', label: 'Evening', icon: 'weather-sunset-down', range: '(6PM - 10PM)', from: 18, to: 22 },
  { key: 'night', label: 'Night', icon: 'weather-night', range: '(10PM - 12AM)', from: 22, to: 24 },
] as const;

export function groupSlotsByPeriod<T extends { start_time: string }>(slots: T[]) {
  return PERIODS.map((p) => ({
    ...p,
    data: slots.filter((s) => {
      const mins = parseClock(s.start_time) ?? -1;
      return mins >= p.from * 60 && mins < p.to * 60;
    }),
  }));
}
