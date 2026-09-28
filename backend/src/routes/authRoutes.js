const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { supabase } = require('../config/supabase');

const router = express.Router();

const isProduction = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || (isProduction ? '' : 'fuel_on_go_dev_secret');
if (isProduction && JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must contain at least 32 characters in production');
}

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_VALUE = '123456';

const otpStore = new Map();

function normalizePhone(phone = '') {
  const digits = String(phone).replace(/\D/g, '');
  const ten = digits.length > 10 ? digits.slice(-10) : digits;
  return `+91${ten}`;
}

function issueToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      phone: user.phone,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function setOtp(phone) {
  otpStore.set(phone, {
    otp: OTP_VALUE,
    expiresAt: Date.now() + OTP_TTL_MS,
  });
}

// OTP is always 123456 — no SMS provider needed
function rejectOtpWhenUnavailable(_res, _phone) {
  return false;
}

function verifyStoredOtp(phone, otp) {
  const stored = otpStore.get(phone);
  if (!stored) return { ok: false, reason: 'OTP not found. Please request OTP again.' };
  if (Date.now() > stored.expiresAt) {
    otpStore.delete(phone);
    return { ok: false, reason: 'OTP expired. Please request OTP again.' };
  }
  if (stored.otp !== otp) return { ok: false, reason: 'Invalid OTP' };
  otpStore.delete(phone);
  return { ok: true };
}

async function getUserByPhone(phone) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('phone', phone)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function createAuthUser(phone, metadata = {}) {
  const digits = phone.replace(/\D/g, '');
  const email = `u${digits}_${Date.now()}@fuelongo.local`;
  const password = `${crypto.randomBytes(10).toString('hex')}Aa1!`;

  let response = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    phone,
    phone_confirm: true,
    user_metadata: metadata,
  });

  if (response.error) {
    response = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { ...metadata, phone },
    });
    if (response.error) throw response.error;
  }

  return response.data.user.id;
}

async function upsertUserProfile(profile, id) {
  const base = {
    id,
    phone: profile.phone,
    name: profile.name || '',
    role: profile.role || 'user',
    vehicle_number: profile.vehicle_number || '',
    vehicle_type: profile.vehicle_type || 'Car',
    trust_score: profile.trust_score ?? 100,
    no_show_count: profile.no_show_count ?? 0,
    is_blocked: profile.is_blocked ?? false,
    email: profile.email || null,
    expo_push_token: profile.expo_push_token || null,
  };

  let insert = await supabase.from('users').insert(base).select('*').single();

  if (insert.error && /email/i.test(insert.error.message || '')) {
    const fallback = {
      id,
      phone: profile.phone,
      name: profile.name || '',
      role: profile.role || 'user',
      vehicle_number: profile.vehicle_number || '',
      vehicle_type: profile.vehicle_type || 'Car',
      trust_score: profile.trust_score ?? 100,
      no_show_count: profile.no_show_count ?? 0,
      is_blocked: profile.is_blocked ?? false,
    };
    insert = await supabase.from('users').insert(fallback).select('*').single();
  }

  if (insert.error) throw insert.error;
  return insert.data;
}

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const token = header.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

router.post('/check-phone', async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    if (!phone || phone.length < 13) {
      return res.status(400).json({ error: 'Valid phone is required' });
    }

    const user = await getUserByPhone(phone);

    return res.json({
      exists: !!user,
      has_name: !!(user && user.name && user.name.trim()),
      role: user?.role || null,
      name: user?.name || null,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/send-otp', async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    if (!phone || phone.length < 13) {
      return res.status(400).json({ error: 'Valid phone is required' });
    }
    if (rejectOtpWhenUnavailable(res, phone)) return;

    setOtp(phone);
    return res.json({
      success: true,
      dev_otp: OTP_VALUE,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/register', async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const name = (req.body.name || '').trim();
    const vehicleNumber = (req.body.vehicle_number || '').trim().toUpperCase();
    const vehicleType = (req.body.vehicle_type || 'Car').trim();
    const email = req.body.email || null;

    if (!phone || !name || !vehicleNumber) {
      return res.status(400).json({ error: 'name, phone, vehicle_number are required' });
    }
    if (rejectOtpWhenUnavailable(res, phone)) return;

    let user = await getUserByPhone(phone);

    if (user) {
      const updatePayload = {
        name,
        vehicle_number: vehicleNumber,
        vehicle_type: vehicleType,
      };

      if (email) updatePayload.email = email;

      let updateResult = await supabase
        .from('users')
        .update(updatePayload)
        .eq('id', user.id)
        .select('*')
        .single();

      if (updateResult.error && /email/i.test(updateResult.error.message || '')) {
        const fallbackPayload = {
          name,
          vehicle_number: vehicleNumber,
          vehicle_type: vehicleType,
        };
        updateResult = await supabase
          .from('users')
          .update(fallbackPayload)
          .eq('id', user.id)
          .select('*')
          .single();
      }

      if (updateResult.error) throw updateResult.error;
      user = updateResult.data;
    } else {
      const authId = await createAuthUser(phone, {
        name,
        phone,
        role: 'user',
      });

      user = await upsertUserProfile(
        {
          phone,
          name,
          role: 'user',
          vehicle_number: vehicleNumber,
          vehicle_type: vehicleType,
          email,
          trust_score: 100,
          no_show_count: 0,
          is_blocked: false,
        },
        authId
      );
    }

    setOtp(phone);
    return res.status(201).json({
      success: true,
      dev_otp: OTP_VALUE,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/register-admin', async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const name = (req.body.name || '').trim();
    const email = (req.body.email || '').trim();
    const businessName = (req.body.business_name || '').trim();

    if (!phone || !name || !email || !businessName) {
      return res.status(400).json({ error: 'name, phone, email, business_name are required' });
    }
    if (rejectOtpWhenUnavailable(res, phone)) return;

    let user = await getUserByPhone(phone);

    if (user) {
      const updatePayload = {
        name,
        role: 'pump_owner',
      };

      if (email) updatePayload.email = email;

      let updateResult = await supabase
        .from('users')
        .update(updatePayload)
        .eq('id', user.id)
        .select('*')
        .single();

      if (updateResult.error && /email/i.test(updateResult.error.message || '')) {
        const fallbackPayload = {
          name,
          role: 'pump_owner',
        };
        updateResult = await supabase
          .from('users')
          .update(fallbackPayload)
          .eq('id', user.id)
          .select('*')
          .single();
      }

      if (updateResult.error) throw updateResult.error;
      user = updateResult.data;
    } else {
      const authId = await createAuthUser(phone, {
        name,
        phone,
        role: 'pump_owner',
        business_name: businessName,
      });

      user = await upsertUserProfile(
        {
          phone,
          name,
          role: 'pump_owner',
          vehicle_number: '',
          vehicle_type: 'Other',
          email,
          trust_score: 100,
          no_show_count: 0,
          is_blocked: false,
        },
        authId
      );
    }

    setOtp(phone);
    return res.status(201).json({
      success: true,
      dev_otp: OTP_VALUE,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/verify-otp', async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const otp = String(req.body.otp || '');

    if (!phone || !otp) {
      return res.status(400).json({ error: 'phone and otp are required' });
    }

    const verify = verifyStoredOtp(phone, otp);
    if (!verify.ok) {
      return res.status(401).json({ error: verify.reason || 'Invalid OTP' });
    }

    const user = await getUserByPhone(phone);
    if (!user) {
      return res.status(404).json({ error: 'User not found. Please register first.' });
    }

    const token = issueToken(user);
    return res.json({ token, user });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, phone, name, email, role, vehicle_number, vehicle_type, trust_score, no_show_count, is_blocked, expo_push_token, created_at')
      .eq('id', req.user.sub)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'User not found' });
    return res.json({ user: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.authenticate = authenticate;
module.exports.normalizePhone = normalizePhone;
