const { RatingError } = require('./ratingPolicy');

const KNOWN = {
  BOOKING_NOT_FOUND: [404, 'Booking not found'],
  NOT_YOUR_BOOKING: [403, 'You can only rate your own booking'],
  NOT_COMPLETED: [409, 'You can rate a pump after your visit is completed'],
  OWN_PUMP: [403, 'You cannot rate a pump you own'],
  EDIT_WINDOW_CLOSED: [409, 'This rating can no longer be edited'],
  RATING_NOT_FOUND: [404, 'Rating not found'],
  NOT_YOUR_PUMP: [403, 'You do not manage this pump'],
  REPORT_NOT_FOUND: [404, 'Report not found'],
  ALREADY_RESOLVED: [409, 'This report was already resolved'],
  BAD_ACTION: [400, 'Invalid action'],
};

function mapError(error) {
  const msg = error?.message || '';
  for (const code of Object.keys(KNOWN)) {
    if (msg.includes(code)) return new RatingError(KNOWN[code][0], code, KNOWN[code][1]);
  }
  if (/pump_ratings|submit_pump_rating|rating_avg|rating_count|pump_rating_reports/i.test(msg) && /does not exist|schema cache|Could not find/i.test(msg)) {
    return new RatingError(503, 'RATINGS_NOT_MIGRATED', 'Ratings are not set up yet (run migration 008)');
  }
  return error;
}

function createSupabaseRatingStore(supabase) {
  const ok = ({ data, error }) => {
    if (error) throw mapError(error);
    return data;
  };

  return {
    async submit(p) {
      return ok(
        await supabase.rpc('submit_pump_rating', {
          p_user_id: p.userId,
          p_booking_id: p.bookingId,
          p_rating: p.rating,
          p_review: p.review,
          p_tags: p.tags,
        })
      );
    },

    async getBooking(id) {
      return ok(await supabase.from('bookings').select('id, user_id, pump_id, status').eq('id', id).maybeSingle());
    },

    async getPump(id) {
      return ok(await supabase.from('pumps').select('id, owner_id, rating_avg, rating_count').eq('id', id).maybeSingle());
    },

    async getRatingByBooking(bookingId) {
      return ok(await supabase.from('pump_ratings').select('*').eq('booking_id', bookingId).maybeSingle());
    },

    async listRatings(pumpId, { limit, offset, includeHidden }) {
      let q = supabase
        .from('pump_ratings')
        .select('id, rating, review, tags, status, edited_count, created_at, updated_at, users(name)')
        .eq('pump_id', pumpId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (!includeHidden) q = q.eq('status', 'visible');
      const rows = ok(await q) || [];
      const mapped = rows.map(({ users, ...r }) => ({ ...r, user_name: users?.name || null }));

      if (includeHidden && mapped.length) {
        const reports = ok(
          await supabase.from('pump_rating_reports').select('rating_id, status').in('rating_id', mapped.map((r) => r.id))
        );
        const byRating = new Map((reports || []).map((r) => [r.rating_id, r.status]));
        mapped.forEach((r) => { r.report_status = byRating.get(r.id) || null; });
      }
      return mapped;
    },

    async listRecent(pumpId, n) {
      return (
        ok(
          await supabase
            .from('pump_ratings')
            .select('rating, created_at')
            .eq('pump_id', pumpId)
            .eq('status', 'visible')
            .order('created_at', { ascending: false })
            .limit(n)
        ) || []
      );
    },

    async report({ ownerId, ratingId, reason }) {
      return ok(await supabase.rpc('report_pump_rating', { p_owner_id: ownerId, p_rating_id: ratingId, p_reason: reason }));
    },

    async resolve({ adminId, reportId, action, note }) {
      return ok(await supabase.rpc('resolve_rating_report', { p_admin_id: adminId, p_report_id: reportId, p_action: action, p_note: note }));
    },
  };
}

module.exports = { createSupabaseRatingStore };
