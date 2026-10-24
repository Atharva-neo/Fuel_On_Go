// Approving a pending booking request. A request can only be approved until its scheduled start:
// once that moment has passed the slot has begun, so the owner has to reject the request
// (which frees the slot) instead. Times are IST wall-clock values.
const { slotStartInstant } = require('./trustScoreService');

class ApprovalError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** True once the booking's scheduled start has been reached. */
function isApprovalExpired(booking, now = new Date()) {
  let start;
  try {
    start = slotStartInstant(booking);
  } catch {
    return false; // unreadable time: do not block on data we cannot interpret
  }
  return now.getTime() >= start.getTime();
}

/**
 * Moves pending -> confirmed. The status guard is part of the UPDATE itself, so two simultaneous
 * approvals (or an approval racing a rejection) cannot both succeed.
 */
async function approvePending({ supabase, booking, now = new Date() }) {
  if (booking.status !== 'pending') {
    throw new ApprovalError(400, 'NOT_PENDING', `Booking is already ${booking.status}, not pending`);
  }
  if (isApprovalExpired(booking, now)) {
    throw new ApprovalError(
      409,
      'BOOKING_EXPIRED',
      'This booking request has expired: its scheduled time has already started. Reject it to free the slot.'
    );
  }
  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'confirmed' })
    .eq('id', booking.id)
    .eq('status', 'pending')
    .select('*');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new ApprovalError(409, 'NOT_PENDING', 'Booking is no longer pending');
  }
  return data[0];
}

module.exports = { ApprovalError, isApprovalExpired, approvePending };
