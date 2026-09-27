const asyncHandler = require('../middleware/asyncHandler');
const Booking = require('../models/Booking');
const Slot = require('../models/Slot');
const { sendSuccess } = require('../utils/response');
const AppError = require('../utils/AppError');
const { createBooking, cancelBooking, checkInBooking } = require('../services/bookingService');
const {
  emitSlotUpdated,
  emitBookingCreated,
  emitBookingCancelled,
  emitBookingStatusChanged,
} = require('../services/socketEmitter');

function toBookingMeta(booking) {
  const slot = booking?.slotId;
  if (!slot?.startTime) return { countdownSeconds: null };
  const countdownSeconds = Math.max(
    0,
    Math.floor((new Date(slot.startTime).getTime() - Date.now()) / 1000)
  );
  return { countdownSeconds };
}

const create = asyncHandler(async (req, res) => {
  const { booking, slot } = await createBooking(req.validated.body);

  emitSlotUpdated(req.app.get('io'), {
    pumpId: booking.pumpId._id,
    slotId: slot._id,
    slot,
  });
  emitBookingCreated(req.app.get('io'), {
    pumpId: booking.pumpId._id,
    slotId: booking.slotId._id,
    bookingId: booking._id,
    token: booking.token,
    tokenNumber: booking.tokenNumber,
    status: booking.status,
  });

  return sendSuccess(res, booking, {
    statusCode: 201,
    message: 'Booking created.',
    meta: toBookingMeta(booking),
  });
});

const getByToken = asyncHandler(async (req, res) => {
  const { token } = req.validated.params;
  const { phone, slotId } = req.validated.query || {};

  const query = { token };
  if (phone) query.phone = phone;
  if (slotId) query.slotId = slotId;

  const booking = await Booking.findOne(query).populate('slotId pumpId');
  if (!booking) throw new AppError('Booking not found.', 404);

  return sendSuccess(res, booking, {
    message: 'Booking fetched.',
    meta: toBookingMeta(booking),
  });
});

const getById = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.validated.params.id).populate('slotId pumpId');
  if (!booking) throw new AppError('Booking not found.', 404);

  return sendSuccess(res, booking, {
    message: 'Booking fetched.',
    meta: toBookingMeta(booking),
  });
});

const cancel = asyncHandler(async (req, res) => {
  const { booking, slot } = await cancelBooking(req.validated.params.id);

  emitSlotUpdated(req.app.get('io'), {
    pumpId: booking.pumpId,
    slotId: booking.slotId,
    slot,
  });
  emitBookingCancelled(req.app.get('io'), {
    pumpId: booking.pumpId,
    slotId: booking.slotId,
    bookingId: booking._id,
    status: booking.status,
  });

  return sendSuccess(res, { bookingId: booking._id }, { message: 'Booking cancelled.' });
});

const checkIn = asyncHandler(async (req, res) => {
  const booking = await checkInBooking(req.validated.params.id);
  const slot = await Slot.findById(booking.slotId._id).lean({ virtuals: true });

  emitBookingStatusChanged(req.app.get('io'), {
    pumpId: booking.pumpId._id,
    slotId: booking.slotId._id,
    bookingId: booking._id,
    status: booking.status,
  });
  if (slot) {
    emitSlotUpdated(req.app.get('io'), {
      pumpId: booking.pumpId._id,
      slotId: slot._id,
      slot,
    });
  }

  return sendSuccess(res, booking, { message: 'Checked in successfully.' });
});

module.exports = {
  create,
  getByToken,
  getById,
  cancel,
  checkIn,
};
