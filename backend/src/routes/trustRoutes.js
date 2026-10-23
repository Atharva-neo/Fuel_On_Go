const express = require('express');
const { supabase } = require('../config/supabase');
const { authenticate } = require('./authRoutes');
const { trust } = require('../services/trustInstance');

const router = express.Router();

async function requireAdminRole(req, res, next) {
  try {
    const { data } = await supabase.from('users').select('role').eq('id', req.user.sub).maybeSingle();
    if (data?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    return next();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

function fail(res, err) {
  return res.status(err.status || 500).json({ error: err.message, code: err.code });
}

// GET /api/trust/me -- the caller's score, label and recent ledger entries.
router.get('/me', authenticate, async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    return res.json(await trust.getSummary(req.user.sub, limit));
  } catch (err) {
    return fail(res, err);
  }
});

// GET /api/trust/users/:userId -- admin view of any user's trust history.
router.get('/users/:userId', authenticate, requireAdminRole, async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);
    return res.json(await trust.getSummary(req.params.userId, limit));
  } catch (err) {
    return fail(res, err);
  }
});

// POST /api/trust/events/:eventId/reverse -- admin resolves a dispute. Writes a
// compensating ledger entry; an event can be reversed exactly once.
router.post('/events/:eventId/reverse', authenticate, requireAdminRole, async (req, res) => {
  try {
    const result = await trust.reverseEvent({
      eventId: req.params.eventId,
      adminId: req.user.sub,
      reason: req.body?.reason,
    });
    return res.status(result.duplicate ? 200 : 201).json({
      reversed: true,
      duplicate: !!result.duplicate,
      score: result.score,
      event: result.event,
    });
  } catch (err) {
    return fail(res, err);
  }
});

module.exports = router;
