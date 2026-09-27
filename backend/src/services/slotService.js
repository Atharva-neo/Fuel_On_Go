const { addDays, addMinutes, endOfDay, startOfDay } = require('date-fns');
const Slot = require('../models/Slot');
const { SLOT_CAPACITY, SLOT_DURATION_MINUTES } = require('../config/constants');

function parseHourMinuteOnDate(baseDate, hhmm) {
  const [hour, minute] = String(hhmm || '06:00').split(':').map((v) => Number(v));
  const d = new Date(baseDate);
  d.setHours(Number.isFinite(hour) ? hour : 6, Number.isFinite(minute) ? minute : 0, 0, 0);
  return d;
}

function normalizeTargetDate(rawDate) {
  if (!rawDate) return startOfDay(new Date());
  if (typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    const [year, month, day] = rawDate.split('-').map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return startOfDay(new Date());
  return startOfDay(parsed);
}

function buildSlotDefinitionsForDay(pump, targetDate) {
  const slots = [];
  const day = normalizeTargetDate(targetDate);

  const openTime = parseHourMinuteOnDate(day, pump.operatingHours?.open || '06:00');
  let closeTime = parseHourMinuteOnDate(day, pump.operatingHours?.close || '22:00');

  if (closeTime <= openTime) {
    closeTime = addDays(closeTime, 1);
  }

  let cursor = new Date(openTime);
  while (cursor < closeTime) {
    const slotEnd = addMinutes(cursor, SLOT_DURATION_MINUTES);
    if (slotEnd > closeTime) break;

    slots.push({
      pumpId: pump._id,
      startTime: new Date(cursor),
      endTime: slotEnd,
      capacity: SLOT_CAPACITY,
      booked: 0,
      nextTokenNumber: 1,
      isActive: pump.isActive && pump.cngLevel >= 10,
    });

    cursor = slotEnd;
  }

  return slots;
}

async function ensureSlotsForDay(pump, targetDate) {
  const dayStart = normalizeTargetDate(targetDate);
  const dayEnd = endOfDay(dayStart);
  const slotDefs = buildSlotDefinitionsForDay(pump, dayStart);

  if (slotDefs.length > 0) {
    const operations = slotDefs.map((slot) => ({
      updateOne: {
        filter: { pumpId: slot.pumpId, startTime: slot.startTime },
        update: {
          $setOnInsert: slot,
          $set: {
            capacity: SLOT_CAPACITY,
          },
        },
        upsert: true,
      },
    }));
    await Slot.bulkWrite(operations, { ordered: false });
  }

  const slots = await Slot.find({
    pumpId: pump._id,
    startTime: { $gte: dayStart, $lte: dayEnd },
  }).sort({ startTime: 1 }).lean({ virtuals: true });

  return slots;
}

module.exports = {
  SLOT_DURATION_MINUTES,
  SLOT_CAPACITY,
  normalizeTargetDate,
  ensureSlotsForDay,
  buildSlotDefinitionsForDay,
};
