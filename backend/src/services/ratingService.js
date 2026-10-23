// Pump rating rules. Persistence sits behind a `store` so the same rules run
// against Supabase in production and an in-memory twin in tests.
//
// store.submit({userId, bookingId, rating, review, tags}) -> {rating, created, duplicate, pump}
// store.getBooking(id)              -> {id, user_id, pump_id, status} | null
// store.getPump(id)                 -> {id, owner_id, rating_avg, rating_count} | null
// store.getRatingByBooking(id)      -> rating | null
// store.listRatings(pumpId, {limit, offset, includeHidden}) -> [{...rating, user_name, report_status?}]
// store.listRecent(pumpId, n)       -> [{rating, created_at}] visible, newest first
// store.report({ownerId, ratingId, reason}) -> {report, duplicate}
// store.resolve({adminId, reportId, action, note}) -> {report_id, action}
const {
  RatingError,
  RATING_TAGS,
  EDIT_WINDOW_DAYS,
  validateSubmission,
  validateReportReason,
  cleanText,
  displayName,
} = require('./ratingPolicy');

function createRatingService({ store, now = () => new Date() }) {
  const publicReview = (r) => ({
    id: r.id,
    rating: r.rating,
    review: r.review,
    tags: r.tags || [],
    reviewer: displayName(r.user_name),
    verified_visit: true, // every stored rating is tied to a completed booking
    created_at: r.created_at,
    edited: (r.edited_count || 0) > 0,
  });

  function distribution(ratings) {
    const out = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of ratings) out[r.rating] += 1;
    return out;
  }

  function summaryOf(pump) {
    const count = Number(pump.rating_count || 0);
    // A pump without reviews has NO rating: never a default, never 5 stars.
    return { average: count > 0 && pump.rating_avg != null ? Number(pump.rating_avg) : null, count };
  }

  async function submit({ userId, body }) {
    const input = validateSubmission(body);
    // body.pump_id (if any) is ignored on purpose: the pump comes from the booking.
    const result = await store.submit({ userId, ...input });
    return {
      rating: publicReview({ ...result.rating, user_name: null }),
      created: !!result.created,
      duplicate: !!result.duplicate,
      pump: { id: result.pump.id, rating_avg: result.pump.rating_avg, rating_count: result.pump.rating_count },
      summary: summaryOf(result.pump),
    };
  }

  // What the app needs to decide whether to show "Rate this pump".
  async function eligibility({ userId, bookingId }) {
    const booking = await store.getBooking(bookingId);
    if (!booking || booking.user_id !== userId) throw new RatingError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
    const pump = await (store.getPumpOwner ? store.getPumpOwner(booking.pump_id) : store.getPump(booking.pump_id));
    // If ratings are not installed yet there is simply no existing rating; submitting then reports the setup problem.
    const existing = await store.getRatingByBooking(bookingId).catch((e) => {
      if (e && e.code === 'RATINGS_NOT_MIGRATED') return null;
      throw e;
    });
    let reason = null;
    if (booking.status !== 'arrived') reason = 'NOT_COMPLETED';
    else if (pump && pump.owner_id && pump.owner_id === userId) reason = 'OWN_PUMP';
    const editable = !!existing && now() - new Date(existing.created_at) <= EDIT_WINDOW_DAYS * 86400000;
    return {
      eligible: reason === null,
      reason,
      pump_id: booking.pump_id,
      rating: existing ? { id: existing.id, rating: existing.rating, review: existing.review, tags: existing.tags || [], editable } : null,
    };
  }

  async function pumpReviews({ pumpId, limit = 20, offset = 0 }) {
    const pump = await store.getPump(pumpId);
    if (!pump) throw new RatingError(404, 'PUMP_NOT_FOUND', 'Pump not found');
    const rows = await store.listRatings(pumpId, { limit, offset, includeHidden: false });
    const all = await store.listRecent(pumpId, 5000);
    return {
      pump_id: pumpId,
      ...summaryOf(pump),
      distribution: distribution(all),
      reviews: rows.map(publicReview),
      has_more: rows.length === limit,
    };
  }

  async function assertOwns(ownerId, pumpId) {
    const pump = await store.getPump(pumpId);
    if (!pump) throw new RatingError(404, 'PUMP_NOT_FOUND', 'Pump not found');
    if (!pump.owner_id || pump.owner_id !== ownerId) {
      throw new RatingError(403, 'NOT_YOUR_PUMP', 'You do not manage this pump');
    }
    return pump;
  }

  // Owner view: only their own pump. No customer phone/vehicle, first name only.
  async function ownerFeedback({ ownerId, pumpId, limit = 30, offset = 0 }) {
    const pump = await assertOwns(ownerId, pumpId);
    const rows = await store.listRatings(pumpId, { limit, offset, includeHidden: true });
    const recent = await store.listRecent(pumpId, 5000);
    const t = now();
    const weeks = [];
    for (let w = 7; w >= 0; w -= 1) {
      const to = t - w * 7 * 86400000;
      const from = to - 7 * 86400000;
      const inWeek = recent.filter((r) => {
        const ts = new Date(r.created_at).getTime();
        return ts > from && ts <= to;
      });
      weeks.push({
        week_ending: new Date(to).toISOString().slice(0, 10),
        count: inWeek.length,
        average: inWeek.length ? Math.round((inWeek.reduce((s, r) => s + r.rating, 0) / inWeek.length) * 10) / 10 : null,
      });
    }
    return {
      pump_id: pumpId,
      ...summaryOf(pump),
      distribution: distribution(recent),
      trend: weeks,
      reviews: rows.map((r) => ({
        ...publicReview(r),
        status: r.status,
        report_status: r.report_status || null,
      })),
      has_more: rows.length === limit,
    };
  }

  async function report({ ownerId, ratingId, reason }) {
    const text = validateReportReason(reason);
    return store.report({ ownerId, ratingId, reason: text });
  }

  async function resolveReport({ adminId, reportId, action, note }) {
    if (!['uphold', 'dismiss'].includes(action)) throw new RatingError(400, 'BAD_ACTION', 'action must be uphold or dismiss');
    const cleanNote = cleanText(note, 500);
    if (!cleanNote) throw new RatingError(400, 'NOTE_REQUIRED', 'A resolution note is required');
    return store.resolve({ adminId, reportId, action, note: cleanNote });
  }

  return { submit, eligibility, pumpReviews, ownerFeedback, report, resolveReport, RATING_TAGS };
}

module.exports = { createRatingService };
