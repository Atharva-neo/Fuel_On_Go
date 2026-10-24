// Owner booking-history filters. Pure: the screen state is turned into query params here, and the
// SAME params go to both the history list and the CSV export, so they always cover the same bookings.
// Dates are IST calendar dates of the scheduled visit (bookings.slot_date).
import { istDate } from './schedule.ts';

export type RangeMode = 'all' | 'week' | 'day';
export type StatusGroup = 'all' | 'pending' | 'confirmed' | 'completed' | 'no_show' | 'cancelled';

/** Calendar math on YYYY-MM-DD strings only. Never goes through local-time Date parsing
 *  (that is what made "Yesterday" skip a day and "Tomorrow" stay put). */
export function shiftDay(iso: string, delta: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export const STATUS_GROUPS: Array<{ key: StatusGroup; label: string; statuses: string[] | null }> = [
  { key: 'all', label: 'All', statuses: null },
  { key: 'pending', label: 'Pending', statuses: ['pending'] },
  { key: 'confirmed', label: 'Confirmed', statuses: ['confirmed'] },
  { key: 'completed', label: 'Completed', statuses: ['arrived'] }, // arrived = QR check-in = completed visit
  { key: 'no_show', label: 'No-show', statuses: ['no_show'] },
  { key: 'cancelled', label: 'Cancelled', statuses: ['cancelled', 'rejected'] },
];

export interface HistoryParams {
  date?: string;
  from?: string;
  to?: string;
  status?: string;
}

export function historyParams(mode: RangeMode, day: string, group: StatusGroup, today: string = istDate(0)): HistoryParams {
  const p: HistoryParams = {};
  if (mode === 'day') p.date = day;
  else if (mode === 'week') {
    p.from = shiftDay(today, -6);
    p.to = today;
  }
  const g = STATUS_GROUPS.find((x) => x.key === group);
  if (g?.statuses) p.status = g.statuses.join(',');
  return p;
}

export function describeRange(mode: RangeMode, day: string, today: string = istDate(0)): string {
  if (mode === 'all') return 'All bookings';
  if (mode === 'week') return 'Last 7 days';
  if (day === today) return `Today (${day})`;
  if (day === shiftDay(today, -1)) return `Yesterday (${day})`;
  if (day === shiftDay(today, 1)) return `Tomorrow (${day})`;
  return day;
}

/** Append the next page without losing or duplicating rows (ids are unique). */
export function mergePage<T extends { id: string }>(current: T[], next: T[]): T[] {
  const seen = new Set(current.map((b) => b.id));
  return [...current, ...next.filter((b) => !seen.has(b.id))];
}
