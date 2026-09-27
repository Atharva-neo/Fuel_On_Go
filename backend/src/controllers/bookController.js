const { pumps, slotsByPump, bookings, nextBookingToken } = require("../data/store");

function recalculatePumpMetrics(pumpId) {
  const slots = slotsByPump[pumpId] || [];
  if (!slots.length) return;

  const totalCapacity = slots.reduce((sum, slot) => sum + slot.capacity, 0);
  const totalBooked = slots.reduce((sum, slot) => sum + slot.booked, 0);
  const occupancy = totalCapacity > 0 ? totalBooked / totalCapacity : 0;

  const pump = pumps.find((item) => item.id === pumpId);
  if (!pump) return;

  const avgQueue = Math.round(totalBooked / slots.length);
  pump.queue = avgQueue;

  if (occupancy >= 0.8) {
    pump.availability = "LOW";
    return;
  }
  if (occupancy >= 0.45) {
    pump.availability = "MEDIUM";
    return;
  }
  pump.availability = "HIGH";
}

function createBooking(req, res, next) {
  try {
    const { pumpId, slotTime } = req.body || {};

    if (!pumpId || !slotTime) {
      return res.status(400).json({
        error: "pumpId and slotTime are required",
      });
    }

    const pump = pumps.find((item) => item.id === String(pumpId));
    if (!pump) {
      return res.status(404).json({
        error: "Pump not found",
      });
    }

    const slots = slotsByPump[String(pumpId)] || [];
    const slot = slots.find((item) => item.time === slotTime);

    if (!slot) {
      return res.status(404).json({
        error: "Slot not found",
      });
    }

    if (slot.booked >= slot.capacity) {
      return res.status(409).json({
        error: "Slot is full",
      });
    }

    slot.booked += 1;
    recalculatePumpMetrics(String(pumpId));

    const tokenNumber = nextBookingToken();
    const booking = {
      id: `B${String(tokenNumber).padStart(4, "0")}`,
      tokenNumber,
      pumpId: String(pumpId),
      slotTime,
      createdAt: new Date().toISOString(),
    };

    bookings.push(booking);

    return res.status(201).json({
      success: true,
      message: "Booking created",
      booking,
      slot: {
        time: slot.time,
        capacity: slot.capacity,
        booked: slot.booked,
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createBooking,
};
