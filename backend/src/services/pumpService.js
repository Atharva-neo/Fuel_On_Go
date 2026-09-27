const { startOfDay } = require('date-fns');
const Pump = require('../models/Pump');
const Slot = require('../models/Slot');
const AppError = require('../utils/AppError');
const { LOW_CNG_THRESHOLD } = require('../config/constants');
const { ensureSlotsForDay, normalizeTargetDate } = require('./slotService');

async function listActivePumps() {
  return Pump.find({ isActive: true }).sort({ createdAt: -1 }).lean({ virtuals: true });
}

async function getPumpById(pumpId) {
  const pump = await Pump.findById(pumpId).lean({ virtuals: true });
  if (!pump) throw new AppError('Pump not found.', 404);
  return pump;
}

async function getPumpSlots(pumpId, dateInput) {
  const pump = await Pump.findById(pumpId);
  if (!pump) throw new AppError('Pump not found.', 404);

  const targetDate = normalizeTargetDate(dateInput);
  const slots = await ensureSlotsForDay(pump, targetDate);
  const isToday = startOfDay(targetDate).getTime() === startOfDay(new Date()).getTime();

  return slots.filter((slot) => {
    if (!slot.isActive) return false;
    if (!isToday) return true;
    return new Date(slot.endTime).getTime() > Date.now();
  });
}

async function updatePumpAvailability(pumpId, updatePayload) {
  const update = {};
  if (updatePayload.cngLevel !== undefined) {
    update.cngLevel = Math.min(100, Math.max(0, Number(updatePayload.cngLevel)));
  }
  if (updatePayload.isActive !== undefined) {
    update.isActive = Boolean(updatePayload.isActive);
  }

  const pump = await Pump.findByIdAndUpdate(pumpId, update, { new: true }).lean({ virtuals: true });
  if (!pump) throw new AppError('Pump not found.', 404);

  const shouldDeactivateSlots = !pump.isActive || pump.cngLevel < LOW_CNG_THRESHOLD;
  if (shouldDeactivateSlots) {
    await Slot.updateMany(
      { pumpId, startTime: { $gte: new Date() } },
      { $set: { isActive: false } }
    );
  } else {
    await Slot.updateMany(
      { pumpId, startTime: { $gte: new Date() } },
      { $set: { isActive: true } }
    );
  }

  return pump;
}

async function addPumpsForDistrict(districtName, pumpCount) {
  const pumps = [];
  for (let i = 0; i < pumpCount; i++) {
    pumps.push({
      name: `${districtName} Pump ${i + 1}`,
      address: `${districtName} Address ${i + 1}`,
      location: {
        lat: 28.6 + Math.random() * 0.1, // Example latitude range
        lng: 77.2 + Math.random() * 0.1, // Example longitude range
      },
      cngLevel: 100,
      cngPricePerKg: 75,
      fuelDensity: 0.75,
      isActive: true,
      operatorName: `Operator ${i + 1}`,
      phone: `98765432${(10 + i).toString().slice(-2)}`,
      operatingHours: {
        open: '08:00',
        close: '20:00',
      },
      slotDuration: 30,
      slotCapacity: 5,
      bufferMinutes: 5,
    });
  }

  await Pump.insertMany(pumps);
  return pumps;
}

module.exports = {
  listActivePumps,
  getPumpById,
  getPumpSlots,
  updatePumpAvailability,
  addPumpsForDistrict,
};
