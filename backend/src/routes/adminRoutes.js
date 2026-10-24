// adminRoutes.js — v2 (force redeploy: slot status computed in JS, not SQL)
const express = require('express');
const router  = express.Router();
const { supabase } = require('../config/supabase');
const { authenticate } = require('./authRoutes');
const { parseCoords } = require('../utils/coords');
const { slotStore } = require('../services/slotInstance');
const { parseHistoryQuery, historyPage, historyAll, toCsv } = require('../services/bookingHistory');
const { getSlotsForDate, applyScheduleChange, ensureUpcoming, bookingsOutside, ScheduleError } = require('../services/slotGenerator');
const { normalizeSchedule, istNow } = require('../services/slotSchedule');

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

// ─── GET /api/admin/bookings/history ─────────────────────────
// Owner's booking history (paginated). Query: date | from,to (slot_date, IST) | status (comma list)
// | limit (<=100) | offset. No date = the complete history.
async function ownerPumps(userId) {
  const { data, error } = await supabase.from('pumps').select('id, name').eq('owner_id', userId);
  if (error) throw error;
  return data || [];
}

router.get('/bookings/history', authenticate, requireAdmin, async (req, res) => {
  try {
    const filter = parseHistoryQuery(req.query);
    const pumps = await ownerPumps(req.user.sub);
    if (!pumps.length) return res.status(404).json({ error: 'No pump found for this account.' });
    return res.json({ ...(await historyPage({ supabase, pumps, filter })), filter: { from: filter.from, to: filter.to, status: filter.statuses } });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message, code: err.code });
  }
});

// ─── GET /api/admin/bookings/export ──────────────────────────
// CSV of EXACTLY the same set as /bookings/history (same filter code), but unpaginated.
router.get('/bookings/export', authenticate, requireAdmin, async (req, res) => {
  try {
    const filter = parseHistoryQuery(req.query);
    const pumps = await ownerPumps(req.user.sub);
    if (!pumps.length) return res.status(404).json({ error: 'No pump found for this account.' });
    const rows = await historyAll({ supabase, pumps, filter });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="bookings-export.csv"`);
    return res.status(200).send(toCsv(rows));
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message, code: err.code });
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
    if (updates.lat !== undefined || updates.lng !== undefined) {
      const coords = parseCoords(updates.lat, updates.lng);
      if (!coords) {
        return res.status(400).json({ error: 'lat and lng must both be valid coordinates', code: 'INVALID_COORDINATES' });
      }
      updates.lat = coords.lat;
      updates.lng = coords.lng;
    }

    const scheduleTouched =
      updates.working_hours_start !== undefined || updates.working_hours_end !== undefined || updates.vehicles_per_slot !== undefined;
    let before = null;
    if (scheduleTouched) {
      const { data: pumpNow, error: pumpNowErr } = await supabase
        .from('pumps')
        .select('working_hours_start, working_hours_end, vehicles_per_slot')
        .eq('id', req.params.id)
        .single();
      if (pumpNowErr) throw pumpNowErr;
      before = pumpNow;

      if (updates.vehicles_per_slot !== undefined) {
        const cap = Number(updates.vehicles_per_slot);
        if (!Number.isInteger(cap) || cap < 1 || cap > 200) {
          return res.status(400).json({ error: 'Vehicles per slot must be a whole number from 1 to 200.', code: 'INVALID_CAPACITY' });
        }
        updates.vehicles_per_slot = cap;
      }

      const newStart = updates.working_hours_start ?? pumpNow.working_hours_start;
      const newEnd = updates.working_hours_end ?? pumpNow.working_hours_end;
      const schedule = normalizeSchedule(newStart, newEnd);
      if (!schedule.ok) return res.status(400).json({ error: schedule.message, code: schedule.code });
      // Store the canonical form ("24:00" for midnight) so every reader agrees.
      updates.working_hours_start = schedule.open;
      updates.working_hours_end = schedule.close;

      // Existing bookings are never cancelled or moved by a schedule change: if any would fall
      // outside the new hours the edit is refused and the conflicts are listed.
      const { data: upcoming, error: rangeErr } = await supabase
        .from('bookings')
        .select('id, slot_date, slot_start, slot_end, status')
        .eq('pump_id', req.params.id)
        .in('status', ['pending', 'confirmed', 'arrived'])
        .gte('slot_date', istNow().date);
      if (rangeErr) throw rangeErr;
      const conflicts = bookingsOutside(schedule, upcoming || []);
      if (conflicts.length) {
        const c = conflicts[0];
        return res.status(409).json({
          error: `Cannot change hours to ${schedule.open}-${schedule.close}: ${conflicts.length} existing booking(s) fall outside this window (e.g. ${c.slot_date} ${String(c.slot_start).slice(0, 5)}-${String(c.slot_end).slice(0, 5)}). Those bookings must be resolved first.`,
          code: 'BOOKINGS_OUTSIDE_HOURS',
          conflicts: conflicts.slice(0, 10),
        });
      }
    }

    const { data, error } = await supabase
      .from('pumps')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    // Regenerate upcoming slots from the schedule that was just SAVED. The pump update is already
    // committed; if only the slot sync fails the owner is told, and Manage Slots retries lazily.
    let slotSync = null;
    if (scheduleTouched) {
      try {
        slotSync = await applyScheduleChange({ store: slotStore, pump: data, before });
      } catch (syncErr) {
        console.error('[Slots] sync after pump update failed:', syncErr.message);
        slotSync = { error: syncErr.message };
      }
    }
    return res.json({ ...data, slot_sync: slotSync });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, code: err.code });
  }
});

// ─── POST /api/admin/pumps (register new pump) ───────────────
router.post('/pumps', authenticate, async (req, res) => {
  try {
    const { name, address, city, district, lat, lng, cng_price_per_kg,
            working_hours_start, working_hours_end, vehicles_per_slot } = req.body;

    if (!parseCoords(lat, lng)) {
      return res.status(400).json({ error: 'A valid pump location (lat/lng) is required', code: 'INVALID_COORDINATES' });
    }

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
      .select('id, working_hours_start, working_hours_end, vehicles_per_slot')
      .eq('owner_id', userId)
      .limit(1)
      .maybeSingle();

    if (pumpErr) throw pumpErr;
    if (!pump) return res.status(404).json({ error: 'No pump found for this account. Please register your pump first.' });

    // Resolve date -- strip any time component, default to today (IST)
    const date = safeDate(req.query.date);

    // Same function the customer-facing list uses: slots are generated from the SAVED
    // schedule if missing, filtered to the operating windows, status derived in IST.
    const result = await getSlotsForDate({ store: slotStore, pump, date });
    return res.json({ slots: result.slots, schedule: result.schedule, date });
  } catch (err) {
    // A real failure is reported as one (never as an empty "no slots" list).
    const status = err.status || 500;
    return res.status(status).json({ error: err.message, code: err.code || 'SLOT_LOAD_FAILED' });
  }
});

// POST /api/admin/slots/regenerate -- rebuild upcoming slots from the saved hours (bookings are kept).
router.post('/slots/regenerate', authenticate, requireAdmin, async (req, res) => {
  try {
    const { data: pump, error } = await supabase
      .from('pumps')
      .select('id, working_hours_start, working_hours_end, vehicles_per_slot')
      .eq('owner_id', req.user.sub)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!pump) return res.status(404).json({ error: 'No pump found for this account.' });
    const result = await applyScheduleChange({ store: slotStore, pump, before: null });
    return res.json(result);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message, code: err.code });
  }
});

module.exports = router;

