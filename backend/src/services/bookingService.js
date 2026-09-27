const { addMinutes } = require('date-fns');
const { v4: uuidv4 } = require('uuid');
const Booking = require('../models/Booking');
const Pump = require('../models/Pump');
const Slot = require('../models/Slot');
const AppError = require('../utils/AppError');
const { generateQR } = require('../utils/qrGenerator');
const {
  BOOKING_LATE_GRACE_MINUTES,
  BOOKING_LOCK_WINDOW_MINUTES,
  LOW_CNG_THRESHOLD,
} = require('../config/constants');

const ACTIVE_BOOKING_STATUSES = ['confirmed', 'checked_in'];

function normalizeVehicleNumber(input) {
  return String(input || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

function generatePublicToken() {
  const ref = uuidv4().replace(/-/g, '').slice(0, 10).toUpperCase();
  return `FG-${ref}`;
}

async function createBooking(payload) {
  const {
    slotId,
    pumpId,
    userName,
    phone,
    vehicleNumber,
    vehicleType = 'Car',
  } = payload;

  const [pump, slot] = await Promise.all([
    Pump.findById(pumpId),
    Slot.findOne({ _id: slotId, pumpId }),
  ]);

  if (!pump || !pump.isActive) {
    throw new AppError('Selected pump is not active right now.', 400);
  }
  if (pump.cngLevel < LOW_CNG_THRESHOLD) {
    throw new AppError('CNG level is low at this pump. Please choose another station.', 409);
  }
  if (!slot || !slot.isActive) {
    throw new AppError('Selected slot is not available.', 404);
  }

  const now = new Date();
  const lockTime = addMinutes(new Date(slot.startTime), -BOOKING_LOCK_WINDOW_MINUTES);
  if (now >= lockTime) {
    throw new AppError('This slot is locked for booking. Please choose a later slot.', 409);
  }

  const normalizedVehicleNumber = normalizeVehicleNumber(vehicleNumber);
  const normalizedPhone = String(phone).trim();

  const duplicateBooking = await Booking.findOne({
    slotId,
    status: { $in: ACTIVE_BOOKING_STATUSES },
    $or: [{ phone: normalizedPhone }, { vehicleNumber: normalizedVehicleNumber }],
  }).lean();

  if (duplicateBooking) {
    throw new AppError('You already have an active booking for this slot.', 409);
  }

  const updatedSlot = await Slot.findOneAndUpdate(
    {
      _id: slotId,
      pumpId,
      isActive: true,
      startTime: { $gt: now },
      $expr: { $lt: ['$booked', '$capacity'] },
    },
    { $inc: { booked: 1, nextTokenNumber: 1 } },
    { new: true }
  ).lean();

  if (!updatedSlot) {
    throw new AppError('Slot is full or no longer available.', 409);
  }

  const tokenNumber = Math.max(1, (updatedSlot.nextTokenNumber || 1) - 1);
  const token = generatePublicToken();

  try {
    const qrPayload = {
      bookingToken: token,
      tokenNumber,
      pumpId: String(pumpId),
      slotId: String(slotId),
      vehicleNumber: normalizedVehicleNumber,
      phone: normalizedPhone,
    };
    const qrCode = await generateQR(qrPayload);

    const booking = await Booking.create({
      slotId,
      pumpId,
      userName: String(userName).trim(),
      phone: normalizedPhone,
      vehicleNumber: normalizedVehicleNumber,
      vehicleType,
      tokenNumber,
      token,
      qrCode,
      status: 'confirmed',
    });

    const populated = await Booking.findById(booking._id).populate('slotId pumpId');
    const refreshedSlot = await Slot.findById(slotId).lean({ virtuals: true });

    return {
      booking: populated,
      slot: refreshedSlot || updatedSlot,
    };
  } catch (error) {
    await Slot.findByIdAndUpdate(slotId, { $inc: { booked: -1 } });
    throw error;
  }
}

async function cancelBooking(bookingId) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new AppError('Booking not found.', 404);
  if (booking.status === 'cancelled') throw new AppError('Booking is already cancelled.', 400);
  if (booking.status === 'completed') throw new AppError('Completed booking cannot be cancelled.', 409);

  booking.status = 'cancelled';
  booking.cancelledAt = new Date();
  await booking.save();

  await Slot.findOneAndUpdate(
    { _id: booking.slotId, booked: { $gt: 0 } },
    { $inc: { booked: -1 } },
    { new: true }
  );

  const slot = await Slot.findById(booking.slotId).lean({ virtuals: true });

  return { booking, slot };
}

async function checkInBooking(bookingId) {
  const booking = await Booking.findById(bookingId).populate('slotId pumpId');
  if (!booking) throw new AppError('Booking not found.', 404);

  if (booking.status === 'cancelled' || booking.status === 'completed') {
    throw new AppError(`Cannot check in a ${booking.status} booking.`, 409);
  }

  if (booking.status === 'checked_in') {
    return booking;
  }

  const slotStart = new Date(booking.slotId.startTime);
  const lateCutoff = addMinutes(slotStart, BOOKING_LATE_GRACE_MINUTES);
  if (new Date() > lateCutoff) {
    booking.status = 'expired';
    booking.expiredAt = new Date();
    await booking.save();
    await Slot.findOneAndUpdate(
      { _id: booking.slotId._id, booked: { $gt: 0 } },
      { $inc: { booked: -1 } }
    );
    throw new AppError('Booking expired due to late arrival.', 409);
  }

  booking.status = 'checked_in';
  booking.checkedInAt = new Date();
  await booking.save();
  return booking;
}

module.exports = {
  ACTIVE_BOOKING_STATUSES,
  createBooking,
  cancelBooking,
  checkInBooking,
};
