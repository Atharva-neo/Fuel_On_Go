const { endOfDay, startOfDay } = require('date-fns');
const asyncHandler = require('../middleware/asyncHandler');
const User = require('../models/User');
const Pump = require('../models/Pump');
const Slot = require('../models/Slot');
const Booking = require('../models/Booking');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/response');
const { generateToken } = require('../utils/jwt');
const { updatePumpAvailability } = require('../services/pumpService');
const { emitPumpUpdated } = require('../services/socketEmitter');

const login = asyncHandler(async (req, res) => {
  const { phone, password } = req.validated.body;
  const user = await User.findOne({ phone, role: 'admin' });

  if (!user) throw new AppError('Invalid credentials.', 401);

  const isValid = await user.comparePassword(password);
  if (!isValid) throw new AppError('Invalid credentials.', 401);

  const token = generateToken({
    id: user._id,
    role: user.role,
    pumpId: user.pumpId,
  });

  return sendSuccess(
    res,
    {
      token,
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
        pumpId: user.pumpId,
      },
    },
    { message: 'Login successful.' }
  );
});

const dashboard = asyncHandler(async (req, res) => {
  const pumpId = req.user.pumpId;
  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);

  const [pump, totalBookings, confirmedBookings, upcomingSlots, recentBookings] = await Promise.all([
    Pump.findById(pumpId).lean({ virtuals: true }),
    Booking.countDocuments({ pumpId, createdAt: { $gte: dayStart, $lte: dayEnd } }),
    Booking.countDocuments({
      pumpId,
      createdAt: { $gte: dayStart, $lte: dayEnd },
      status: { $in: ['confirmed', 'checked_in'] },
    }),
    Slot.find({ pumpId, startTime: { $gte: now }, isActive: true })
      .sort({ startTime: 1 })
      .limit(12)
      .lean({ virtuals: true }),
    Booking.find({ pumpId })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('slotId')
      .lean({ virtuals: true }),
  ]);

  if (!pump) throw new AppError('Admin pump not found.', 404);

  return sendSuccess(res, {
    pump,
    totalBookings,
    confirmedBookings,
    slots: upcomingSlots,
    recentBookings,
  }, { message: 'Dashboard data fetched.' });
});

const updatePump = asyncHandler(async (req, res) => {
  const pumpId = req.validated.params.id;

  if (String(req.user.pumpId) !== String(pumpId)) {
    throw new AppError('You can only update your own pump.', 403);
  }

  const pump = await updatePumpAvailability(pumpId, req.validated.body);

  if (req.validated.body.operatingHours) {
    await Pump.findByIdAndUpdate(pumpId, { operatingHours: req.validated.body.operatingHours });
  }
  if (req.validated.body.slotCapacity !== undefined) {
    await Pump.findByIdAndUpdate(pumpId, { slotCapacity: Math.min(5, req.validated.body.slotCapacity) });
  }

  const updatedPump = await Pump.findById(pumpId).lean({ virtuals: true });
  emitPumpUpdated(req.app.get('io'), updatedPump);

  return sendSuccess(res, updatedPump || pump, { message: 'Pump updated.' });
});

const bookings = asyncHandler(async (req, res) => {
  const { status, limit = 20, page = 1 } = req.validated.query;
  const query = { pumpId: req.user.pumpId };
  if (status) query.status = status;

  const skip = (page - 1) * limit;
  const [rows, total] = await Promise.all([
    Booking.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('slotId')
      .lean({ virtuals: true }),
    Booking.countDocuments(query),
  ]);

  return sendSuccess(res, rows, {
    message: 'Bookings fetched.',
    meta: {
      total,
      page,
      limit,
    },
  });
});

module.exports = {
  login,
  dashboard,
  updatePump,
  bookings,
};
