const express = require('express');
const { supabase } = require('../config/supabase');
const { authenticate } = require('./authRoutes');
const { slotStore } = require('../services/slotInstance');
const { getSlotsForDate } = require('../services/slotGenerator');
const { istNow, SLOT_DURATION_MINUTES, formatClock, normalizeSchedule, withinWindows } = require('../services/slotSchedule');

const router = express.Router();

async function requirePumpOwner(req) {
  const { data, error } = await supabase.from('users').select('role').eq('id', req.user.sub).single();
  if (error) throw error;
  if (!['pump_owner', 'admin'].includes(data.role)) {
    const err = new Error('Pump owner access required');
    err.status = 403;
    throw err;
  }
}

async function ensureOwnerCanManageSlot(userId, slotId) {
  const { data: slot, error: slotErr } = await supabase
    .from('slots')
    .select('id, pump_id')
    .eq('id', slotId)
    .single();

  if (slotErr) throw slotErr;

  const { data: pump, error: pumpErr } = await supabase
    .from('pumps')
    .select('owner_id, name')
    .eq('id', slot.pump_id)
    .single();

  if (pumpErr) throw pumpErr;
  if (pump.owner_id !== userId) {
    const err = new Error('You do not own this pump');
    err.status = 403;
    throw err;
  }

  return slot;
}

router.get('/:pumpId', async (req, res) => {
  try {
    const date = String(req.query.date || istNow().date).slice(0, 10);

    const { data: pump, error: pumpErr } = await supabase
      .from('pumps')
      .select('id, is_active, working_hours_start, working_hours_end, vehicles_per_slot')
      .eq('id', req.params.pumpId)
      .maybeSingle();
    if (pumpErr) throw pumpErr;
    if (!pump) return res.status(404).json({ error: 'Pump not found' });

    // Identical to the owner's Manage Slots list: generated from the saved schedule, windows applied.
    const result = await getSlotsForDate({ store: slotStore, pump, date });
    return res.json(result.slots);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message, code: err.code });
  }
});

router.patch('/:slotId/deactivate', authenticate, async (req, res) => {
  try {
    await requirePumpOwner(req);
    await ensureOwnerCanManageSlot(req.user.sub, req.params.slotId);

    const { reason } = req.body;

    const payload = {
      is_deactivated: true,
      deactivation_reason: reason || 'Temporarily paused',
    };

    const update = await supabase.from('slots').update(payload).eq('id', req.params.slotId).select('*').single();

    if (update.error) throw update.error;
    return res.json(update.data);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
});

router.patch('/:slotId/activate', authenticate, async (req, res) => {
  try {
    await requirePumpOwner(req);
    await ensureOwnerCanManageSlot(req.user.sub, req.params.slotId);

    const update = await supabase
      .from('slots')
      .update({
        is_deactivated: false,
        deactivation_reason: null,
      })
      .eq('id', req.params.slotId)
      .select('*')
      .single();

    if (update.error) throw update.error;
    return res.json(update.data);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
});

router.patch('/:slotId/capacity', authenticate, async (req, res) => {
  try {
    await requirePumpOwner(req);
    await ensureOwnerCanManageSlot(req.user.sub, req.params.slotId);

    const nextCap = Number(req.body.capacity);
    if (!Number.isFinite(nextCap) || nextCap < 1) {
      return res.status(400).json({ error: 'capacity must be >= 1' });
    }

    const { data: slot, error: slotErr } = await supabase
      .from('slots')
      .select('booked_count')
      .eq('id', req.params.slotId)
      .single();

    if (slotErr) throw slotErr;
    if (nextCap < slot.booked_count) {
      return res.status(400).json({ error: 'capacity cannot be less than booked_count' });
    }

    const { data, error } = await supabase
      .from('slots')
      .update({ capacity: nextCap })
      .eq('id', req.params.slotId)
      .select('*')
      .single();

    if (error) throw error;
    return res.json(data);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
});

router.patch('/:slotId/time', authenticate, async (req, res) => {
  try {
    await requirePumpOwner(req);
    await ensureOwnerCanManageSlot(req.user.sub, req.params.slotId);

    const timeRe = /^([01]\d|2[0-3]):([0-5]\d)$/;
    const startTime = String(req.body.start_time || '').trim();

    if (!timeRe.test(startTime)) {
      return res.status(400).json({ error: 'start_time must be in HH:MM format' });
    }

    // Slot length is the app-wide SLOT_DURATION_MINUTES; end_time is derived, never client-supplied.
    const [h, m] = startTime.split(':').map(Number);
    const startMin = h * 60 + m;
    const endMin = startMin + SLOT_DURATION_MINUTES;
    if (endMin > 24 * 60) {
      return res.status(400).json({ error: 'A slot starting here would run past midnight' });
    }
    const endTime = formatClock(endMin);

    const { data: slot, error: slotErr } = await supabase
      .from('slots')
      .select('id, pump_id, slot_date, booked_count')
      .eq('id', req.params.slotId)
      .single();
    if (slotErr) throw slotErr;

    if (slot.booked_count > 0) {
      return res.status(400).json({ error: 'Cannot change timing for a slot that already has bookings' });
    }

    const { data: pumpHours, error: pumpHoursErr } = await supabase
      .from('pumps')
      .select('working_hours_start, working_hours_end')
      .eq('id', slot.pump_id)
      .single();
    if (pumpHoursErr) throw pumpHoursErr;
    const schedule = normalizeSchedule(pumpHours.working_hours_start, pumpHours.working_hours_end);
    if (schedule.ok && !withinWindows(schedule, startMin, endMin)) {
      return res.status(400).json({ error: `This time is outside the pump operating hours (${schedule.open}-${schedule.close})`, code: 'OUTSIDE_HOURS' });
    }

    const { data: siblingSlots, error: siblingErr } = await supabase
      .from('slots')
      .select('id, start_time, end_time')
      .eq('pump_id', slot.pump_id)
      .eq('slot_date', slot.slot_date)
      .neq('id', slot.id);
    if (siblingErr) throw siblingErr;

    const overlaps = (siblingSlots || []).some((s) => {
      const sStart = String(s.start_time).slice(0, 5);
      const sEnd = String(s.end_time).slice(0, 5);
      return startTime < sEnd && endTime > sStart;
    });
    if (overlaps) {
      return res.status(400).json({ error: 'This time overlaps with another slot on the same day' });
    }

    const { data, error } = await supabase
      .from('slots')
      .update({ start_time: startTime, end_time: endTime })
      .eq('id', req.params.slotId)
      .select('*')
      .single();

    if (error) throw error;
    return res.json(data);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
});

router.post('/bulk-deactivate', authenticate, async (req, res) => {
  try {
    await requirePumpOwner(req);

    const { pump_id, from_time, to_time, reason, date } = req.body;
    if (!pump_id || !from_time || !to_time || !reason) {
      return res.status(400).json({ error: 'pump_id, from_time, to_time and reason are required' });
    }

    const targetDate = date || istNow().date;

    const { data: pump, error: pumpErr } = await supabase
      .from('pumps')
      .select('id, owner_id')
      .eq('id', pump_id)
      .single();

    if (pumpErr) throw pumpErr;
    if (pump.owner_id !== req.user.sub) {
      return res.status(403).json({ error: 'You do not own this pump' });
    }

    const { data: slots, error: slotsErr } = await supabase
      .from('slots')
      .select('id')
      .eq('pump_id', pump_id)
      .eq('slot_date', targetDate)
      .gte('start_time', from_time)
      .lte('start_time', to_time);

    if (slotsErr) throw slotsErr;

    const slotIds = (slots || []).map((s) => s.id);
    if (!slotIds.length) {
      return res.json({ deactivated_slots: 0, cancelled_bookings: 0 });
    }

    const updateResult = await supabase
      .from('slots')
      .update({
        is_deactivated: true,
        deactivation_reason: reason,
      })
      .in('id', slotIds);

    if (updateResult.error) throw updateResult.error;

    const { data: cancelled, error: cancelErr } = await supabase
      .from('bookings')
      .update({ status: 'cancelled', cancellation_reason: reason })
      .in('slot_id', slotIds)
      .eq('status', 'confirmed')
      .select('id');

    if (cancelErr && !/column .*cancellation_reason/i.test(cancelErr.message || '')) throw cancelErr;

    if (cancelErr && /column .*cancellation_reason/i.test(cancelErr.message || '')) {
      const fallbackCancel = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .in('slot_id', slotIds)
        .eq('status', 'confirmed')
        .select('id');
      if (fallbackCancel.error) throw fallbackCancel.error;
      return res.json({ deactivated_slots: slotIds.length, cancelled_bookings: (fallbackCancel.data || []).length });
    }

    return res.json({
      deactivated_slots: slotIds.length,
      cancelled_bookings: (cancelled || []).length,
    });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
});

module.exports = router;
