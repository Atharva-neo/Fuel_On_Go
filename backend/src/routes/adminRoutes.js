// adminRoutes.js — v2 (force redeploy: slot status computed in JS, not SQL)
const express = require('express');
const router  = express.Router();
const { supabase } = require('../config/supabase');
const { authenticate } = require('./authRoutes');

// Helper: ensure date is always YYYY-MM-DD, strip any time component
function safeDate(d) {
  if (!d) {
    const now = new Date();
    const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    return ist.toISOString().split('T')[0];
  }
  // Accept "YYYY-MM-DDTHH:MM:SS" or "YYYY-MM-DD"
  return String(d).slice(0, 10);
}

// GET /api/admin/version — deploy verification
router.get('/version', (_req, res) => res.json({ version: 2, deployed: new Date().toISOString() }));

// ─── Middleware: pump owner or admin ─────────────────────────
async function requireAdmin(req, res, next) {
  const { data } = await supabase
    .from('users')
    .select('role')
    .eq('id', req.user.sub)
    .single();
  if (!data || !['admin','pump_owner'].includes(data.role)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  req.userRole = data.role;
  next();
}

// ─── POST /api/admin/checkin  (QR scan) ──────────────────────
router.post('/checkin', authenticate, requireAdmin, async (req, res) => {
  try {
    const { qr_token } = req.body;
    if (!qr_token) return res.status(400).json({ error: 'qr_token required' });

    const { data, error } = await supabase.rpc('checkin_booking', {
      p_qr_token: qr_token,
      p_admin_id: req.user.sub,
    });

    if (error) throw error;

    // Fetch user info
    const { data: booking } = await supabase
      .from('bookings')
      .select('*, users(name,vehicle_number,trust_score), pumps(name)')
      .eq('id', data.id)
      .single();

    res.json({
      success: true,
      booking: data,
      customer: booking?.users,
    });
  } catch (err) {
    const status = err.message.includes('Invalid') ? 404
                 : err.message.includes('authorized') ? 403
                 : 500;
    res.status(status).json({ error: err.message });
  }
});

// ─── GET /api/admin/stats ────────────────────────────────────
router.get('/stats', authenticate, requireAdmin, async (req, res) => {
  try {
    const { pump_id, date } = req.query;
    const d = safeDate(date);

    let pumpId = pump_id;
    if (!pumpId) {
      // Default to first pump owned by this user
      const { data: pump } = await supabase
        .from('pumps')
        .select('id')
        .eq('owner_id', req.user.sub)
        .limit(1)
        .maybeSingle();
      pumpId = pump?.id;
    }

    if (!pumpId) return res.status(400).json({ error: 'No pump found for this admin' });

    const { data: slots }    = await supabase.from('slots').select('capacity,booked_count').eq('pump_id', pumpId).eq('slot_date', d);
    const { data: bookings } = await supabase.from('bookings').select('status,amount_paid_now,pending_amount').eq('pump_id', pumpId).eq('slot_date', d);

    const total_slots    = (slots || []).reduce((s, x) => s + x.capacity, 0);
    const booked_slots   = (slots || []).reduce((s, x) => s + x.booked_count, 0);
    const arrived_count  = (bookings || []).filter(b => b.status === 'arrived').length;
    const no_show_count  = (bookings || []).filter(b => b.status === 'no_show').length;
    const booking_fee_collected = (bookings || []).reduce((s, b) => s + Number(b.amount_paid_now), 0);
    const pending_collection    = (bookings || []).filter(b => b.status === 'arrived').reduce((s, b) => s + Number(b.pending_amount), 0);

    res.json({ pump_id: pumpId, date: d, total_slots, booked_slots, arrived_count, no_show_count, booking_fee_collected, pending_collection });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/dashboard', authenticate, requireAdmin, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { data: pump, error: pumpErr } = await supabase
      .from('pumps')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pumpErr) throw pumpErr;

    if (!pump) {
      return res.json({
        success: true,
        has_pump: false,
        data: null,
      });
    }

    const today = new Date();
    const y = today.getUTCFullYear();
    const m = String(today.getUTCMonth() + 1).padStart(2, '0');
    const d = String(today.getUTCDate()).padStart(2, '0');
    const todayDate = `${y}-${m}-${d}`;

    const { data: slots, error: slotsErr } = await supabase
      .from('slots')
      .select('id, capacity, booked_count, start_time, end_time')
      .eq('pump_id', pump.id)
      .eq('slot_date', todayDate);
    if (slotsErr) throw slotsErr;

    const slotIds = (slots || []).map((s) => s.id);
    let bookings = [];
    if (slotIds.length) {
      const { data: bData, error: bErr } = await supabase
        .from('bookings')
        .select('*')
        .in('slot_id', slotIds);
      if (bErr) throw bErr;
      bookings = bData || [];
    }

    return res.json({
      success: true,
      has_pump: true,
      data: {
        pump,
        stats: {
          total_slots: slots?.length || 0,
          booked: bookings.filter((b) => b.status === 'confirmed').length,
          arrived: bookings.filter((b) => b.status === 'arrived').length,
          no_shows: bookings.filter((b) => b.status === 'no_show').length,
          cancelled: bookings.filter((b) => b.status === 'cancelled').length,
          revenue_collected: bookings
            .filter((b) => b.status !== 'cancelled')
            .reduce((sum, b) => sum + Number(b.booking_fee || 0), 0),
          pending_at_pump: bookings
            .filter((b) => b.status === 'arrived')
            .reduce((sum, b) => sum + Number(b.remaining_amount || b.pending_amount || 0), 0),
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/admin/bookings ─────────────────────────────────
router.get('/bookings', authenticate, requireAdmin, async (req, res) => {
  try {
    const { pump_id, date, status } = req.query;
    const d = safeDate(date);

    let query = supabase.from('bookings')
      .select('*, users(name,vehicle_number,trust_score), pumps(name)')
      .eq('slot_date', d)
      .order('slot_start');

    if (pump_id) query = query.eq('pump_id', pump_id);
    if (status)  query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/admin/bookings/export ──────────────────────────
// CSV export of this pump owner's own bookings (their scan log).
// Query params: date=YYYY-MM-DD (optional, all dates if omitted),
// status=arrived|confirmed|cancelled|no_show (optional, all if omitted)
function csvEscape(value) {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

router.get('/bookings/export', authenticate, requireAdmin, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { data: myPumps, error: pumpErr } = await supabase
      .from('pumps')
      .select('id, name')
      .eq('owner_id', userId);
    if (pumpErr) throw pumpErr;

    const pumpIds = (myPumps || []).map((p) => p.id);
    if (!pumpIds.length) {
      return res.status(404).json({ error: 'No pump found for this account.' });
    }
    const pumpNameById = (myPumps || []).reduce((acc, p) => { acc[p.id] = p.name; return acc; }, {});

    let query = supabase
      .from('bookings')
      .select('id, pump_id, user_id, slot_date, slot_start, slot_end, status, booking_fee, updated_at')
      .in('pump_id', pumpIds)
      .order('slot_date', { ascending: false })
      .order('slot_start', { ascending: true });

    if (req.query.date) query = query.eq('slot_date', req.query.date);
    if (req.query.status) query = query.eq('status', req.query.status);

    const { data: bookings, error: bookErr } = await query;
    if (bookErr) throw bookErr;

    const userIds = [...new Set((bookings || []).map((b) => b.user_id).filter(Boolean))];
    let usersById = {};
    if (userIds.length) {
      const { data: users } = await supabase
        .from('users')
        .select('id, name, phone, vehicle_number, vehicle_type')
        .in('id', userIds);
      usersById = (users || []).reduce((acc, u) => { acc[u.id] = u; return acc; }, {});
    }

    const header = ['Pump', 'Date', 'Slot Start', 'Slot End', 'Customer Name', 'Phone', 'Vehicle Number', 'Vehicle Type', 'Status', 'Booking Fee', 'Checked-in At'];
    const rows = (bookings || []).map((b) => {
      const u = usersById[b.user_id] || {};
      return [
        pumpNameById[b.pump_id] || '',
        b.slot_date,
        String(b.slot_start || '').slice(0, 5),
        String(b.slot_end || '').slice(0, 5),
        u.name || '',
        u.phone || '',
        u.vehicle_number || '',
        u.vehicle_type || '',
        b.status,
        Number(b.booking_fee || 0).toFixed(2),
        b.status === 'arrived' ? b.updated_at : '',
      ];
    });

    const csv = [header, ...rows].map((r) => r.map(csvEscape).join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="bookings-export.csv"`);
    return res.status(200).send(csv);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/admin/pumps/:id ──────────────────────────────
// Lets a pump owner edit any detail of their own pump at any time
// (not just at registration). Only fields actually present in the
// request body are updated -- everything else is left untouched.
router.patch('/pumps/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { data: existing, error: findErr } = await supabase
      .from('pumps')
      .select('owner_id')
      .eq('id', req.params.id)
      .single();
    if (findErr) throw findErr;
    if (existing.owner_id !== req.user.sub) {
      return res.status(403).json({ error: 'You do not own this pump' });
    }

    const allowedFields = [
      'name', 'address', 'city', 'district', 'pin_code',
      'working_hours_start', 'working_hours_end', 'vehicles_per_slot',
      'cng_price_per_kg', 'fuel_density', 'supply_status', 'public_message',
      'lat', 'lng',
    ];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'No editable fields provided' });
    }

    const { data, error } = await supabase
      .from('pumps')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/admin/pumps (register new pump) ───────────────
router.post('/pumps', authenticate, async (req, res) => {
  try {
    const { name, address, city, district, lat, lng, cng_price_per_kg,
            working_hours_start, working_hours_end, vehicles_per_slot } = req.body;

    const { data, error } = await supabase
      .from('pumps')
      .insert({
        owner_id: req.user.sub,
        name, address, city: city || '', district: district || '',
        lat, lng, cng_price_per_kg: cng_price_per_kg || 89.00,
        working_hours_start: working_hours_start || '06:00',
        working_hours_end:   working_hours_end   || '22:00',
        vehicles_per_slot:   vehicles_per_slot   || 5,
        is_active:  true,
        is_verified: false,
      })
      .select()
      .single();

    if (error) throw error;

    // Generate slots for today and tomorrow
    await supabase.rpc('generate_daily_slots', { p_pump_id: data.id, p_date: new Date().toISOString().split('T')[0] });

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/admin/slots ────────────────────────────────────
// Returns all slots for the authenticated pump owner's pump
// Query param: ?date=YYYY-MM-DD (default: today IST)
router.get('/slots', authenticate, requireAdmin, async (req, res) => {
  try {
    const userId = req.user.sub;

    // Find this owner's pump
    const { data: pump, error: pumpErr } = await supabase
      .from('pumps')
      .select('id')
      .eq('owner_id', userId)
      .limit(1)
      .maybeSingle();

    if (pumpErr) throw pumpErr;
    if (!pump) return res.status(404).json({ error: 'No pump found for this account. Please register your pump first.' });

    // Resolve date — strip any time component, default to today IST
    const date = safeDate(req.query.date);

    // Fetch slots for the pump on that date
    const { data: slots, error: slotsErr } = await supabase
      .from('slots')
      .select('id, start_time, end_time, capacity, booked_count, is_deactivated, deactivation_reason, slot_date')
      .eq('pump_id', pump.id)
      .eq('slot_date', date)
      .order('start_time', { ascending: true });

    if (slotsErr) throw slotsErr;

    // Derive status — the slots table has no status column, so compute it
    const now = new Date();
    const enriched = (slots || []).map((slot) => {
      const booked = slot.booked_count || 0;
      const capacity = slot.capacity || 5;
      let st;
      if (slot.is_deactivated) st = 'deactivated';
      else if (booked >= capacity) st = 'full';
      else if (new Date(`${slot.slot_date}T${slot.start_time}`).getTime() < now.getTime()) st = 'expired';
      else st = 'open';
      return {
        ...slot,
        status: st,
        booked_count: booked,
        capacity,
      };
    });

    return res.json({ slots: enriched });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;

