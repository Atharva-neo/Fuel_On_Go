const express = require('express');
const { supabase } = require('../config/supabase');
const { authenticate } = require('./authRoutes');

const router = express.Router();

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function getUserRole(userId) {
  const { data, error } = await supabase.from('users').select('role').eq('id', userId).single();
  if (error) throw error;
  return data.role;
}

async function fetchActivePumpsWithFallback(filters = {}) {
  let query = supabase.from('pump_availability').select('*').limit(500);

  if (filters.north != null) query = query.lte('lat', filters.north);
  if (filters.south != null) query = query.gte('lat', filters.south);
  if (filters.east != null) query = query.lte('lng', filters.east);
  if (filters.west != null) query = query.gte('lng', filters.west);

  let { data, error } = await query;

  if (!error) return data || [];

  let fallback = supabase.from('pumps').select('*').eq('is_active', true).limit(500);
  if (filters.north != null) fallback = fallback.lte('lat', filters.north);
  if (filters.south != null) fallback = fallback.gte('lat', filters.south);
  if (filters.east != null) fallback = fallback.lte('lng', filters.east);
  if (filters.west != null) fallback = fallback.gte('lng', filters.west);

  const second = await fallback;
  if (second.error) throw second.error;

  return (second.data || []).map((pump) => ({
    ...pump,
    available_slots_today: 0,
    status: 'low',
  }));
}

async function buildNearbyList({ lat, lng, radius, north, south, east, west }) {
  const hasBbox = [north, south, east, west].every((v) => v !== null && v !== undefined && v !== '');

  const filters = hasBbox
    ? {
        north: toNumber(north),
        south: toNumber(south),
        east: toNumber(east),
        west: toNumber(west),
      }
    : {};

  const pumps = await fetchActivePumpsWithFallback(filters);

  if (lat == null || lng == null) {
    return pumps.slice(0, 100);
  }

  const userLat = toNumber(lat);
  const userLng = toNumber(lng);
  const limitRadius = Math.max(1000, toNumber(radius, 30000));

  const enriched = pumps
    .map((pump) => {
      const distance = haversineKm(userLat, userLng, Number(pump.lat), Number(pump.lng));
      return {
        ...pump,
        distance_km: Math.round(distance * 10) / 10,
      };
    })
    .filter((pump) => {
      if (hasBbox) return true;
      return pump.distance_km * 1000 <= limitRadius;
    })
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, 100);

  return enriched;
}

router.get('/nearby', async (req, res) => {
  try {
    const { lat, lng, radius, north, south, east, west } = req.query;
    const nearby = await buildNearbyList({ lat, lng, radius, north, south, east, west });
    return res.json(nearby);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { lat, lng, radius, north, south, east, west } = req.query;
    const nearby = await buildNearbyList({ lat, lng, radius, north, south, east, west });
    return res.json(nearby);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/create', authenticate, async (req, res) => {
  try {
    const {
      name,
      license_number,
      address,
      city,
      district,
      pin_code,
      lat,
      lng,
      working_hours_start,
      working_hours_end,
      vehicles_per_slot,
      cng_price_per_kg,
    } = req.body;

    if (!name || !license_number || !address || !city || !district || lat == null || lng == null) {
      return res.status(400).json({ error: 'name, license_number, address, city, district, lat, lng are required' });
    }

    const payload = {
      owner_id: req.user.sub,
      name,
      address,
      city,
      district,
      pin_code: pin_code || null,
      lat: Number(lat),
      lng: Number(lng),
      working_hours_start: working_hours_start || '06:00',
      working_hours_end: working_hours_end || '22:00',
      vehicles_per_slot: Number(vehicles_per_slot || 5),
      cng_price_per_kg: Number(cng_price_per_kg || 89.5),
      is_active: true,
    };

    let insert = await supabase.from('pumps').insert(payload).select('*').single();

    if (insert.error && /pin_code/i.test(insert.error.message || '')) {
      const fallback = { ...payload };
      delete fallback.pin_code;
      insert = await supabase.from('pumps').insert(fallback).select('*').single();
    }

    if (insert.error) throw insert.error;

    await supabase
      .from('users')
      .update({ role: 'pump_owner' })
      .eq('id', req.user.sub)
      .eq('role', 'user');

    for (let day = 0; day < 7; day += 1) {
      const d = new Date();
      d.setDate(d.getDate() + day);
      const iso = d.toISOString().slice(0, 10);
      await supabase.rpc('generate_daily_slots', {
        p_pump_id: insert.data.id,
        p_date: iso,
      });
    }

    return res.status(201).json(insert.data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/my-pump', authenticate, async (req, res) => {
  try {
    const role = await getUserRole(req.user.sub);
    if (!['pump_owner', 'admin'].includes(role)) {
      return res.status(403).json({ error: 'Pump owner access required' });
    }

    const { data: pump, error: pumpErr } = await supabase
      .from('pumps')
      .select('*')
      .eq('owner_id', req.user.sub)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pumpErr) throw pumpErr;

    if (!pump) {
      return res.json({
        pump: null,
        stats: {
          booked: 0,
          arrived: 0,
          no_shows: 0,
          revenue: 0,
        },
      });
    }

    const today = new Date().toISOString().slice(0, 10);

    const { data: bookings, error: bookingsErr } = await supabase
      .from('bookings')
      .select('status, amount_paid_now, pending_amount')
      .eq('pump_id', pump.id)
      .eq('slot_date', today);

    if (bookingsErr) throw bookingsErr;

    const list = bookings || [];
    const booked = list.filter((b) => b.status === 'confirmed' || b.status === 'arrived').length;
    const arrived = list.filter((b) => b.status === 'arrived').length;
    const noShows = list.filter((b) => b.status === 'no_show').length;
    const revenue = list
      .filter((b) => b.status === 'arrived')
      .reduce((sum, b) => sum + Number(b.amount_paid_now || 0) + Number(b.pending_amount || 0), 0);

    return res.json({
      pump,
      stats: {
        booked,
        arrived,
        no_shows: noShows,
        revenue,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/my-bookings', authenticate, async (req, res) => {
  try {
    const role = await getUserRole(req.user.sub);
    if (!['pump_owner', 'admin'].includes(role)) {
      return res.status(403).json({ error: 'Pump owner access required' });
    }

    const date = req.query.date || new Date().toISOString().slice(0, 10);

    const { data: pumps, error: pumpErr } = await supabase
      .from('pumps')
      .select('id, name')
      .eq('owner_id', req.user.sub);

    if (pumpErr) throw pumpErr;

    const pumpIds = (pumps || []).map((p) => p.id);
    if (!pumpIds.length) return res.json([]);

    const { data: bookings, error: bookingErr } = await supabase
      .from('bookings')
      .select('*')
      .in('pump_id', pumpIds)
      .eq('slot_date', date)
      .order('slot_start', { ascending: true });

    if (bookingErr) throw bookingErr;

    const userIds = [...new Set((bookings || []).map((b) => b.user_id).filter(Boolean))];

    let usersById = {};
    if (userIds.length) {
      const { data: users } = await supabase
        .from('users')
        .select('id, name, phone, vehicle_number')
        .in('id', userIds);

      usersById = (users || []).reduce((acc, u) => {
        acc[u.id] = u;
        return acc;
      }, {});
    }

    const pumpById = (pumps || []).reduce((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {});

    const result = (bookings || []).map((booking) => ({
      ...booking,
      user: usersById[booking.user_id] || null,
      pump: pumpById[booking.pump_id] || null,
      slot: {
        start_time: booking.slot_start,
        end_time: booking.slot_end,
        date: booking.slot_date,
      },
    }));

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/my', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase.from('pumps').select('*').eq('owner_id', req.user.sub);
    if (error) throw error;
    return res.json(data || []);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    let query = supabase.from('pump_availability').select('*').eq('id', req.params.id).maybeSingle();
    let { data, error } = await query;

    if (error) {
      const fallback = await supabase.from('pumps').select('*').eq('id', req.params.id).maybeSingle();
      data = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Pump not found' });

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
