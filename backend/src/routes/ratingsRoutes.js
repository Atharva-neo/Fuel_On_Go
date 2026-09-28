const express = require('express');
const router  = express.Router();
const { supabase } = require('../config/supabase');
const { authenticate } = require('./authRoutes');

// ─── GET /api/ratings/:pumpId ─────────────────────────────────
router.get('/:pumpId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('ratings')
      .select('*')
      .eq('pump_id', req.params.pumpId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    const avgRating = data.length > 0
      ? Math.round((data.reduce((s, r) => s + r.rating, 0) / data.length) * 10) / 10
      : 4.0;

    res.json({ ratings: data, avg_rating: avgRating, count: data.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/ratings ────────────────────────────────────────
router.post('/', authenticate, async (req, res) => {
  try {
    const { pump_id, rating, review } = req.body;
    if (!pump_id || !rating) return res.status(400).json({ error: 'pump_id and rating required' });
    if (rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be 1-5' });

    const { data, error } = await supabase
      .from('ratings')
      .upsert({ pump_id, user_id: req.user.sub, rating, review }, { onConflict: 'pump_id,user_id' })
      .select()
      .single();

    if (error) throw error;

    // Update pump's cached avg rating
    const { data: allRatings } = await supabase
      .from('ratings')
      .select('rating')
      .eq('pump_id', pump_id);

    if (allRatings) {
      const avg = allRatings.reduce((s, r) => s + r.rating, 0) / allRatings.length;
      await supabase
        .from('pumps')
        .update({ rating: Math.round(avg * 10) / 10 })
        .eq('id', pump_id);
    }

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
