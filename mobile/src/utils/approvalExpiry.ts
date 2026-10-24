// A pending booking request can only be approved until its scheduled start (IST wall-clock).
// Mirrors backend/src/services/bookingApproval.js, which is the authority; this only decides
// whether to show the Approve button.
export function approvalExpired(
  booking: { slot_date?: string | null; slot_start?: string | null },
  nowMs: number = Date.now()
): boolean {
  if (!booking.slot_date || !booking.slot_start) return false;
  const clock = String(booking.slot_start);
  const hms = clock.length <= 5 ? `${clock}:00` : clock.slice(0, 8);
  const start = new Date(`${String(booking.slot_date).slice(0, 10)}T${hms}+05:30`).getTime();
  return Number.isFinite(start) && nowMs >= start;
}
