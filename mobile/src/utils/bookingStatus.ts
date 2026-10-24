// Single source of truth for which My Bookings tab a booking belongs to.
//
// The booking lifecycle in this app (backend `bookings.status`):
//   pending -> confirmed -> arrived          (pump operator approves, then scans the QR on arrival)
//   pending -> rejected                      (operator declines)
//   pending/confirmed -> cancelled           (customer cancels)
//   confirmed -> no_show                     (operator confirms the customer never came)
// There is no separate "refuelling completed" status: the operator's QR check-in (`arrived`) is the
// last event the system records for a visit, so `arrived` is what the app treats as a COMPLETED visit.
// (Fuel delivery itself is not independently verified.) A future explicit `completed` status is
// handled too.
//
// Rules: the backend status decides the tab. The clock is only used to stop an unresolved
// pending/confirmed booking from sitting in "Upcoming" after its slot has ended; those are shown as
// "Expired", never relabelled as completed or cancelled.
import { parseClock, slotStartMs } from './schedule.ts';

export type BookingTab = 'upcoming' | 'completed' | 'cancelled';
export type BookingTone = 'amber' | 'green' | 'red' | 'blue' | 'neutral';

export interface BookingLike {
  status?: string | null;
  slot_date?: string | null;
  slot_start?: string | null;
  slot_end?: string | null;
}

export interface Classified {
  tab: BookingTab;
  label: string;
  /** Stable id for translation: status.<key> */
  key: string;
  tone: BookingTone;
  expired: boolean;
}

/** End of the booked slot as an absolute instant (IST, understands "24:00"). NaN if unknown. */
export function slotEndMs(b: BookingLike): number {
  if (!b.slot_date) return NaN;
  const date = String(b.slot_date).slice(0, 10);
  const end = b.slot_end ?? b.slot_start;
  return end && parseClock(String(end).slice(0, 8)) !== null ? slotStartMs(date, String(end).slice(0, 8)) : NaN;
}

export function slotStartInstant(b: BookingLike): number {
  if (!b.slot_date || !b.slot_start) return NaN;
  return slotStartMs(String(b.slot_date).slice(0, 10), String(b.slot_start).slice(0, 8));
}

export function classifyBooking(b: BookingLike, now: Date = new Date()): Classified {
  const status = String(b.status ?? '').toLowerCase();
  const ended = slotEndMs(b) < now.getTime(); // NaN compares false: unknown time never expires a booking

  switch (status) {
    case 'pending':
      return ended
        ? { tab: 'cancelled', label: 'Expired', key: 'expired', tone: 'neutral', expired: true }
        : { tab: 'upcoming', label: 'Pending Approval', key: 'pending_approval', tone: 'amber', expired: false };
    case 'confirmed':
    case 'approved':
      return ended
        ? { tab: 'completed', label: 'Expired', key: 'expired', tone: 'neutral', expired: true }
        : { tab: 'upcoming', label: 'Confirmed', key: 'confirmed', tone: 'green', expired: false };
    case 'arrived':
    case 'completed':
      return { tab: 'completed', label: 'Completed', key: 'completed', tone: 'green', expired: false };
    case 'no_show':
      return { tab: 'completed', label: 'No Show', key: 'no_show', tone: 'red', expired: false };
    case 'cancelled':
      return { tab: 'cancelled', label: 'Cancelled', key: 'cancelled', tone: 'red', expired: false };
    case 'rejected':
      return { tab: 'cancelled', label: 'Rejected', key: 'rejected', tone: 'red', expired: false };
    default:
      // Unknown status: never guess "upcoming".
      return { tab: 'completed', label: status ? status.replace(/_/g, ' ') : 'Unknown', key: 'unknown', tone: 'neutral', expired: false };
  }
}

export function bookingsForTab<T extends BookingLike>(bookings: T[], tab: BookingTab, now: Date = new Date()): T[] {
  const picked = bookings.filter((b) => classifyBooking(b, now).tab === tab);
  // Upcoming: soonest first. History: most recent first.
  return picked.sort((a, b) => {
    const d = (slotStartInstant(a) || 0) - (slotStartInstant(b) || 0);
    return tab === 'upcoming' ? d : -d;
  });
}
