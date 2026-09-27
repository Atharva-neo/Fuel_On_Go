const express = require('express');
const crypto = require('crypto');
const { supabase } = require('../config/supabase');
const { authenticate } = require('./authRoutes');

const router = express.Router();

function randomToken(prefix) {
  return `${prefix}${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
}

async function getUserRole(userId) {
  const { data, error } = await supabase.from('users').select('role').eq('id', userId).single();
  if (error) throw error;
  return data.role;
}

router.post('/', authenticate, async (req, res) => {
  try {
    const {
      pump_id,
      slot_id,
      slot_date,
      slot_start,
      slot_end,
      booking_fee,
      total_estimated,
      amount_paid_now,
      pending_amount,
      fuel_payment_method,
      payment_option,
    } = req.body;

    if (!pump_id || !slot_id || !slot_date || !slot_start || !slot_end) {
      return res.status(400).json({ error: 'pump_id, slot_id, slot_date, slot_start and slot_end are required' });
    }

    const { data: slot, error: slotErr } = await supabase
      .from('slots')
      .select('*')
      .eq('id', slot_id)
      .single();

    if (slotErr || !slot) {
      return res.status(404).json({ error: 'Slot not found' });
    }

    if (slot.is_deactivated) {
      return res.status(400).json({ error: 'Slot is deactivated' });
    }

    if ((slot.booked_count || 0) >= (slot.capacity || 0)) {
      return res.status(400).json({ error: 'Slot is full' });
    }

    const payload = {
      user_id: req.user.sub,
      pump_id,
      slot_id,
      slot_date,
      slot_start,
      slot_end,
      status: 'confirmed',
      qr_token: randomToken('QR-'),
      booking_fee: Number(booking_fee || 0),
      total_estimated: Number(total_estimated || 0),
      amount_paid_now: Number(amount_paid_now || 0),
      pending_amount: Number(pending_amount || 0),
      fuel_payment_method: fuel_payment_method || 'cash',
      payment_option: payment_option || 'partial',
    };

    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .insert(payload)
      .select('*')
      .single();

    if (bookingErr) throw bookingErr;

    await supabase
      .from('slots')
      .update({ booked_count: (slot.booked_count || 0) + 1 })
      .eq('id', slot_id);

    const { data: pump } = await supabase
      .from('pumps')
      .select('name, address, lat, lng')
      .eq('id', pump_id)
      .maybeSingle();

    return res.status(201).json({
      ...booking,
      pump_name: pump?.name,
      pump_address: pump?.address,
      pump_lat: pump?.lat,
      pump_lng: pump?.lng,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('user_id', req.user.sub)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const pumpIds = [...new Set((bookings || []).map((b) => b.pump_id))];

    let pumpById = {};
    if (pumpIds.length) {
      const { data: pumps } = await supabase.from('pumps').select('id, name, address, lat, lng').in('id', pumpIds);
      pumpById = (pumps || []).reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
      }, {});
    }

    const formatted = (bookings || []).map((b) => ({
      ...b,
      pump_name: pumpById[b.pump_id]?.name || null,
      pump_address: pumpById[b.pump_id]?.address || null,
      pump_lat: pumpById[b.pump_id]?.lat || null,
      pump_lng: pumpById[b.pump_id]?.lng || null,
    }));

    return res.json(formatted);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.sub)
      .maybeSingle();

    if (error) throw error;
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const { data: pump } = await supabase
      .from('pumps')
      .select('name, address, lat, lng')
      .eq('id', booking.pump_id)
      .maybeSingle();

    const { data: slot } = await supabase
      .from('slots')
      .select('*')
      .eq('id', booking.slot_id)
      .maybeSingle();

    const { data: user } = await supabase
      .from('users')
      .select('id, name, phone, vehicle_number, vehicle_type')
      .eq('id', booking.user_id)
      .maybeSingle();

    return res.json({
      ...booking,
      pump: pump || null,
      slot: slot || null,
      user: user || null,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/confirm', authenticate, async (req, res) => {
  try {
    const userId = req.user.sub;
    const {
      slot_id,
      cng_amount_kg,
      booking_fee,
      total_estimated,
      remaining_amount,
      fuel_payment_method,
    } = req.body;

    if (!slot_id) {
      return res.status(400).json({ error: 'slot_id is required' });
    }

    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('id, is_blocked')
      .eq('id', userId)
      .single();
    if (userErr) throw userErr;
    if (user?.is_blocked) {
      return res.status(403).json({ error: 'User is blocked from booking' });
    }

    const { data: slot, error: slotErr } = await supabase
      .from('slots')
      .select('*')
      .eq('id', slot_id)
      .single();
    if (slotErr) throw slotErr;

    if ((slot.booked_count || 0) >= (slot.capacity || 0)) {
      return res.status(409).json({ error: 'Slot is full' });
    }

    const slotStart = new Date(slot.start_time || `${slot.slot_date}T${slot.start_time}`);
    if (Number.isFinite(slotStart.getTime()) && slotStart.getTime() < Date.now()) {
      return res.status(400).json({ error: 'Slot has expired' });
    }

    const bookingPayload = {
      user_id: userId,
      slot_id,
      pump_id: slot.pump_id,
      slot_date: slot.slot_date,
      slot_start: slot.start_time?.slice?.(0, 5) || slot.start_time,
      slot_end: slot.end_time?.slice?.(0, 5) || slot.end_time,
      status: 'confirmed',
      cng_amount_kg: Number(cng_amount_kg || 0),
      booking_fee: Number(booking_fee || 0),
      total_estimated: Number(total_estimated || 0),
      remaining_amount: Number(remaining_amount || 0),
      pending_amount: Number(remaining_amount || 0),
      fuel_payment_method: fuel_payment_method || 'cash',
      qr_token: crypto.randomUUID(),
      amount_paid: Number(booking_fee || 0),
      amount_paid_now: Number(booking_fee || 0),
      qr_used: false,
    };

    const { data: inserted, error: insErr } = await supabase
      .from('bookings')
      .insert(bookingPayload)
      .select('*')
      .single();
    if (insErr) throw insErr;

    const { error: updErr } = await supabase
      .from('slots')
      .update({ booked_count: (slot.booked_count || 0) + 1 })
      .eq('id', slot_id);
    if (updErr) throw updErr;

    return res.status(201).json(inserted);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .select('id, status, slot_id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.sub)
      .maybeSingle();

    if (bookingErr) throw bookingErr;
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.status === 'cancelled') return res.status(400).json({ error: 'Already cancelled' });

    const updatePayload = {
      status: 'cancelled',
      cancellation_reason: 'Cancelled by user',
      refund_amount: Number(req.body?.refund || 0),
    };

    let updated = await supabase
      .from('bookings')
      .update(updatePayload)
      .eq('id', booking.id)
      .select('*')
      .single();

    if (updated.error && /column .*cancellation_reason|column .*refund_amount/i.test(updated.error.message || '')) {
      updated = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', booking.id)
        .select('*')
        .single();
    }

    if (updated.error) throw updated.error;

    const { data: slot } = await supabase
      .from('slots')
      .select('booked_count')
      .eq('id', booking.slot_id)
      .maybeSingle();

    if (slot && slot.booked_count > 0) {
      await supabase
        .from('slots')
        .update({ booked_count: slot.booked_count - 1 })
        .eq('id', booking.slot_id);
    }

    return res.json(updated.data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/checkin-by-admin', authenticate, async (req, res) => {
  try {
    const role = await getUserRole(req.user.sub);
    if (!['pump_owner', 'admin'].includes(role)) {
      return res.status(403).json({ error: 'Not authorized as pump owner' });
    }

    let qrToken = req.body.qr_token;
    if (!qrToken) {
      return res.status(400).json({ error: 'qr_token is required' });
    }

    if (typeof qrToken === 'string' && qrToken.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(qrToken);
        qrToken = parsed.qr_token || qrToken;
      } catch {
        // keep raw token
      }
    }

    let bookingResp = await supabase.from('bookings').select('*').eq('qr_token', qrToken).maybeSingle();

    if ((!bookingResp.data || bookingResp.error) && qrToken.length >= 8) {
      bookingResp = await supabase.from('bookings').select('*').eq('id', qrToken).maybeSingle();
    }

    if (bookingResp.error && bookingResp.error.code !== 'PGRST116') {
      throw bookingResp.error;
    }

    const booking = bookingResp.data;
    if (!booking) {
      return res.status(404).json({ error: 'Invalid QR code' });
    }

    if (booking.qr_used || booking.status === 'arrived') {
      return res.status(409).json({
        error: 'Already checked in',
        arrived_at: booking.arrived_at || booking.updated_at,
      });
    }

    const { data: pump, error: pumpErr } = await supabase
      .from('pumps')
      .select('id, owner_id, name')
      .eq('id', booking.pump_id)
      .single();

    if (pumpErr) throw pumpErr;

    if (pump.owner_id !== req.user.sub) {
      return res.status(403).json({
        error: 'This booking belongs to another pump',
        pump_name: pump.name,
      });
    }

    const slotStart = new Date(`${booking.slot_date}T${booking.slot_start}:00+05:30`);
    const slotEnd = new Date(`${booking.slot_date}T${booking.slot_end}:00+05:30`);
    const now = new Date();

    const allowedStart = new Date(slotStart.getTime() - 5 * 60 * 1000);

    if (now < allowedStart) {
      return res.status(400).json({
        error: 'Too early',
        slot_time: slotStart.toISOString(),
        code: 'TOO_EARLY',
      });
    }

    if (now > slotEnd) {
      return res.status(400).json({
        error: 'Slot expired',
        code: 'EXPIRED',
      });
    }

    const nowIso = new Date().toISOString();
    const { data: updated, error: updateErr } = await supabase
      .from('bookings')
      .update({ status: 'arrived', qr_used: true, arrived_at: nowIso })
      .eq('id', booking.id)
      .select('*')
      .single();

    if (updateErr) throw updateErr;

    const { data: user } = await supabase
      .from('users')
      .select('name, phone, vehicle_number')
      .eq('id', booking.user_id)
      .maybeSingle();

    await supabase
      .from('users')
      .update({ trust_score: Math.min(Number(user?.trust_score || 0) + 2, 100) })
      .eq('id', booking.user_id);

    return res.json({
      success: true,
      customer_name: user?.name || 'Customer',
      customer_phone: user?.phone || null,
      vehicle_number: user?.vehicle_number || '-',
      vehicle_type: user?.vehicle_type || null,
      slot_time: `${booking.slot_start} - ${booking.slot_end}`,
      cng_amount_kg: Number(booking.cng_amount_kg || 0),
      booking_fee_paid: Number(booking.booking_fee || booking.amount_paid_now || 0),
      remaining_amount: Number(booking.remaining_amount || booking.pending_amount || 0),
      fuel_payment_method: booking.fuel_payment_method,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
