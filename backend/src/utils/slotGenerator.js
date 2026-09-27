const Slot = require('../models/Slot');

/**
 * Parse HH:MM and set on a specific date
 */
function parseTime(baseDate, hhmm) {
  const [hour, minute] = String(hhmm || '08:00').split(':').map(Number);
  const d = new Date(baseDate);
  d.setHours(hour || 8, minute || 0, 0, 0);
  return d;
}

/**
 * Generate slot definitions for one pump on one day
 */
function buildSlotsForDay(pump, date) {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);

  const openTime = parseTime(dayStart, pump.operatingHours?.open || '08:00');
  const closeTime = parseTime(dayStart, pump.operatingHours?.close || '20:00');
  const duration = pump.slotDuration || 30;
  const capacity = pump.slotCapacity || 5;

  const slots = [];
  let cursor = new Date(openTime);

  while (cursor < closeTime) {
    const slotEnd = new Date(cursor.getTime() + duration * 60 * 1000);
    if (slotEnd > closeTime) break;

    slots.push({
      pumpId: pump._id,
      startTime: new Date(cursor),
      endTime: new Date(slotEnd),
      capacity,
      booked: 0,
      nextTokenNumber: 1,
      isActive: true,
    });

    cursor = slotEnd;
  }

  return slots;
}

/**
 * Ensure slots exist for a pump on a given date (upsert)
 */
async function ensureSlotsForPump(pump, date) {
  const defs = buildSlotsForDay(pump, date);
  if (defs.length === 0) return;

  const ops = defs.map((slot) => ({
    updateOne: {
      filter: { pumpId: slot.pumpId, startTime: slot.startTime },
      update: { $setOnInsert: slot },
      upsert: true,
    },
  }));

  await Slot.bulkWrite(ops, { ordered: false });
}

/**
 * Generate slots for all pumps for the next N days
 */
async function generateSlotsForAllPumps(pumps, daysAhead = 7) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const pump of pumps) {
    for (let i = 0; i <= daysAhead; i++) {
      const date = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
      await ensureSlotsForPump(pump, date);
    }
  }
}

module.exports = { buildSlotsForDay, ensureSlotsForPump, generateSlotsForAllPumps };
