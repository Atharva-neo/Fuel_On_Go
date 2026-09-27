const { SOCKET_EVENTS } = require('../config/constants');

function getPumpRoom(pumpId) {
  return `pump:${String(pumpId)}`;
}

function emitPumpUpdated(io, pump) {
  if (!io || !pump) return;
  io.emit(SOCKET_EVENTS.PUMP_UPDATED, pump);
  io.to(getPumpRoom(pump._id)).emit(SOCKET_EVENTS.PUMP_UPDATED, pump);
}

function emitSlotUpdated(io, payload) {
  if (!io || !payload?.slot) return;
  const room = getPumpRoom(payload.pumpId || payload.slot.pumpId);
  io.to(room).emit(SOCKET_EVENTS.SLOT_UPDATED, payload);
  io.emit(SOCKET_EVENTS.SLOT_UPDATED, payload);
}

function emitBookingCreated(io, payload) {
  if (!io || !payload) return;
  io.to(getPumpRoom(payload.pumpId)).emit(SOCKET_EVENTS.BOOKING_CREATED, payload);
  io.emit(SOCKET_EVENTS.BOOKING_CREATED, payload);
}

function emitBookingCancelled(io, payload) {
  if (!io || !payload) return;
  io.to(getPumpRoom(payload.pumpId)).emit(SOCKET_EVENTS.BOOKING_CANCELLED, payload);
  io.emit(SOCKET_EVENTS.BOOKING_CANCELLED, payload);
}

function emitBookingStatusChanged(io, payload) {
  if (!io || !payload) return;
  io.to(getPumpRoom(payload.pumpId)).emit(SOCKET_EVENTS.BOOKING_STATUS_CHANGED, payload);
}

module.exports = {
  getPumpRoom,
  emitPumpUpdated,
  emitSlotUpdated,
  emitBookingCreated,
  emitBookingCancelled,
  emitBookingStatusChanged,
};
