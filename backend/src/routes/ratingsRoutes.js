const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { authenticate } = require('./authRoutes');
const { ratings } = require('../services/ratingInstance');

const fail = (res, err) => res.status(err.status || 500).json({ error: err.message, code: err.code });
const page = (q) => ({
  limit: Math.min(Math.max(parseInt(q.limit, 10) || 20, 1), 50),
  offset: Math.max(parseInt(q.offset, 10) || 0, 0),
});

async function roleOf(userId) {
  const { data } = await supabase.from('users').select('role').eq('id', userId).maybeSingle();
  return data?.role;
}

// POST /api/ratings -- rate the pump of one completed booking.
// The pump comes from the booking; a client-sent pump_id is ignored.
router.post('/', authenticate, async (req, res) => {
  try {
    const result = await ratings.submit({ userId: req.user.sub, body: req.body });
    return res.status(result.created ? 201 : 200).json(result);
  } catch (err) {
    return fail(res, err);
  }
});

// GET /api/ratings/booking/:bookingId -- can I rate this booking? (and my existing rating)
router.get('/booking/:bookingId', authenticate, async (req, res) => {
  try {
    return res.json(await ratings.eligibility({ userId: req.user.sub, bookingId: req.params.bookingId }));
  } catch (err) {
    return fail(res, err);
  }
});

// GET /api/ratings/pump/:pumpId -- public: average, count, distribution, visible reviews.
router.get('/pump/:pumpId', async (req, res) => {
  try {
    return res.json(await ratings.pumpReviews({ pumpId: req.params.pumpId, ...page(req.query) }));
  } catch (err) {
    return fail(res, err);
  }
});

// GET /api/ratings/owner/:pumpId -- owner view of feedback for their own pump.
router.get('/owner/:pumpId', authenticate, async (req, res) => {
  try {
    const role = await roleOf(req.user.sub);
    if (!['pump_owner', 'admin'].includes(role)) return res.status(403).json({ error: 'Pump owner access required' });
    return res.json(await ratings.ownerFeedback({ ownerId: req.user.sub, pumpId: req.params.pumpId, ...page(req.query) }));
  } catch (err) {
    return fail(res, err);
  }
});

// POST /api/ratings/:ratingId/report -- owner flags a review for moderation (cannot delete/edit it).
router.post('/:ratingId/report', authenticate, async (req, res) => {
  try {
    const role = await roleOf(req.user.sub);
    if (!['pump_owner', 'admin'].includes(role)) return res.status(403).json({ error: 'Pump owner access required' });
    const out = await ratings.report({ ownerId: req.user.sub, ratingId: req.params.ratingId, reason: req.body?.reason });
    return res.status(out.duplicate ? 200 : 201).json(out);
  } catch (err) {
    return fail(res, err);
  }
});

// POST /api/ratings/reports/:reportId/resolve -- admin only; 'uphold' hides the review, 'dismiss' keeps it.
router.post('/reports/:reportId/resolve', authenticate, async (req, res) => {
  try {
    if ((await roleOf(req.user.sub)) !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    return res.json(
      await ratings.resolveReport({
        adminId: req.user.sub,
        reportId: req.params.reportId,
        action: req.body?.action,
        note: req.body?.note,
      })
    );
  } catch (err) {
    return fail(res, err);
  }
});

module.exports = router;
