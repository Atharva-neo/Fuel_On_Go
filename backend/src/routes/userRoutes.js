const express = require('express');
const { supabase } = require('../config/supabase');
const { authenticate } = require('./authRoutes');

const router = express.Router();

router.get('/me', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.user.sub)
      .single();
    if (error) throw error;
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/stats', authenticate, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('id, name, phone, vehicle_number, vehicle_type, trust_score, is_blocked')
      .eq('id', userId)
      .single();
    if (userErr) throw userErr;

    const { count: totalBookings, error: totalErr } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (totalErr) throw totalErr;

    const { count: arrivedCount, error: arrivedErr } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'arrived');
    if (arrivedErr) throw arrivedErr;

    const { count: noShowCount, error: noShowErr } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'no_show');
    if (noShowErr) throw noShowErr;

    const { count: cancelledCount, error: cancelledErr } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'cancelled');
    if (cancelledErr) throw cancelledErr;

    return res.json({
      total_bookings: totalBookings || 0,
      arrived_count: arrivedCount || 0,
      no_show_count: noShowCount || 0,
      cancelled_count: cancelledCount || 0,
      trust_score: user?.trust_score ?? 100,
      is_blocked: user?.is_blocked ?? false,
      name: user?.name || '',
      phone: user?.phone || '',
      vehicle_number: user?.vehicle_number || '',
      vehicle_type: user?.vehicle_type || '',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/push-token', authenticate, async (req, res) => {
  try {
    const token = req.body?.token;
    if (!token) return res.status(400).json({ error: 'Token required' });
    const { error } = await supabase
      .from('users')
      .update({ expo_push_token: token })
      .eq('id', req.user.sub);
    if (error) throw error;
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
