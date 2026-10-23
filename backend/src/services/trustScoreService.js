// Trust Score business rules. Persistence is behind a `store` so the same
// rules run against Supabase in production and an in-memory ledger in tests.
//
// store.applyEvent(params) -> { applied, duplicate, event, score }
// store.getEvent(id)       -> event | null
// store.listEvents(userId, limit) -> events (newest first)
// store.getUser(userId)    -> { trust_score, no_show_count } | null
const { defaultPolicy, scoreBand, cancellationPenalty } = require('../config/trustPolicy');

class TrustError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

const toHms = (t) => (String(t).length <= 5 ? `${t}:00` : String(t).slice(0, 8));

// Slot times are stored as local (IST) wall-clock values.
function slotStartInstant(booking) {
  const d = new Date(`${String(booking.slot_date).slice(0, 10)}T${toHms(booking.slot_start)}+05:30`);
  if (Number.isNaN(d.getTime())) throw new TrustError(400, 'BAD_SLOT_TIME', 'Booking has an invalid slot time');
  return d;
}

function slotEndInstant(booking) {
  const d = new Date(`${String(booking.slot_date).slice(0, 10)}T${toHms(booking.slot_end)}+05:30`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function createTrustService({ store, policy = defaultPolicy, now = () => new Date() }) {
  const view = (event) =>
    event && {
      id: event.id,
      event_type: event.event_type,
      booking_id: event.booking_id,
      delta: event.applied_delta,
      score_after: event.score_after,
      reason: event.reason,
      reversal_of: event.reversal_of || null,
      created_at: event.created_at,
    };

  // Pure: what would cancelling `booking` at `at` cost?
  function evaluateCancellation(booking, previousStatus, at = now()) {
    if (previousStatus === 'pending') {
      return { delta: 0, tier: 'Request was never confirmed by the pump', hoursUntilSlot: null };
    }
    const hours = (slotStartInstant(booking).getTime() - at.getTime()) / 3600000;
    const { penalty, label } = cancellationPenalty(hours, policy);
    return { delta: -penalty, tier: label, hoursUntilSlot: Number(hours.toFixed(2)) };
  }

  // Called after the booking row has been moved to `cancelled` by the customer.
  async function recordUserCancellation({ booking, previousStatus, at = now() }) {
    const ev = evaluateCancellation(booking, previousStatus, at);
    const result = await store.applyEvent({
      userId: booking.user_id,
      bookingId: booking.id,
      eventType: 'cancellation',
      delta: ev.delta,
      idempotencyKey: `cancel:${booking.id}`,
      reason: `Cancelled by customer: ${ev.tier}`,
      actorId: booking.user_id,
      metadata: { hours_until_slot: ev.hoursUntilSlot, previous_status: previousStatus },
    });
    return { ...ev, ...result };
  }

  // Pure: may this booking be declared a no-show at `at`?
  function noShowEligibility(booking, at = now()) {
    if (booking.status !== 'confirmed' && booking.status !== 'no_show') {
      return { ok: false, code: 'NOT_CONFIRMED', message: `A ${booking.status} booking cannot be a no-show` };
    }
    const eligibleAt = new Date(slotStartInstant(booking).getTime() + policy.noShowGraceMinutes * 60000);
    if (at < eligibleAt) {
      return { ok: false, code: 'GRACE_PERIOD', message: 'Grace period has not ended yet', eligibleAt };
    }
    return { ok: true, eligibleAt };
  }

  // Booking row must already be 'no_show' (set by the conditional update that
  // won the race); this writes the -15 exactly once.
  async function recordVerifiedNoShow({ booking, operatorId, at = now() }) {
    const elig = noShowEligibility({ ...booking, status: 'no_show' }, at);
    if (!elig.ok) throw new TrustError(400, elig.code, elig.message);
    return store.applyEvent({
      userId: booking.user_id,
      bookingId: booking.id,
      eventType: 'no_show',
      delta: -policy.noShowPenalty,
      idempotencyKey: `no_show:${booking.id}`,
      reason: 'No-show confirmed by pump operator',
      actorId: operatorId,
      metadata: { grace_minutes: policy.noShowGraceMinutes },
    });
  }

  async function reverseEvent({ eventId, adminId, reason }) {
    if (!reason || !String(reason).trim()) throw new TrustError(400, 'REASON_REQUIRED', 'A reason is required');
    const original = await store.getEvent(eventId);
    if (!original) throw new TrustError(404, 'EVENT_NOT_FOUND', 'Trust event not found');
    if (original.event_type === 'dispute_reversal') {
      throw new TrustError(400, 'CANNOT_REVERSE_A_REVERSAL', 'A reversal cannot be reversed');
    }
    const result = await store.applyEvent({
      userId: original.user_id,
      bookingId: original.booking_id,
      eventType: 'dispute_reversal',
      delta: -original.applied_delta,
      idempotencyKey: `reversal:${original.id}`,
      reason: String(reason).trim(),
      actorId: adminId,
      reversalOf: original.id,
      metadata: { original_type: original.event_type },
    });
    return result;
  }

  async function getSummary(userId, limit = 10) {
    const user = await store.getUser(userId);
    if (!user) throw new TrustError(404, 'USER_NOT_FOUND', 'User not found');
    let events = [];
    let historyAvailable = true;
    try {
      events = await store.listEvents(userId, limit);
    } catch (err) {
      if (err.code !== 'TRUST_NOT_MIGRATED') throw err;
      historyAvailable = false; // ledger table not installed yet: still show the score
    }
    const reversed = new Set(events.map((e) => e.reversal_of).filter(Boolean));
    const band = scoreBand(user.trust_score, policy);
    return {
      score: user.trust_score,
      label: band.label,
      band: band.key,
      no_show_count: user.no_show_count || 0,
      history_available: historyAvailable,
      recent_events: events.map((e) => ({ ...view(e), reversed: reversed.has(e.id) })),
      policy: {
        default_score: policy.defaultScore,
        no_show_penalty: policy.noShowPenalty,
        no_show_grace_minutes: policy.noShowGraceMinutes,
        cancellation_tiers: policy.cancellationTiers.map((t) => ({ label: t.label, penalty: t.penalty })),
      },
    };
  }

  return {
    evaluateCancellation,
    recordUserCancellation,
    noShowEligibility,
    recordVerifiedNoShow,
    reverseEvent,
    getSummary,
    policy,
  };
}

module.exports = { createTrustService, TrustError, slotStartInstant, slotEndInstant };
