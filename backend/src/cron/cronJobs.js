const Booking = require('../models/Booking');
const Slot = require('../models/Slot');
const User = require('../models/User');
const Pump = require('../models/Pump');
const { generateSlotsForAllPumps } = require('../utils/slotGenerator');

/**
 * Mark confirmed bookings as no_show if slot started > 10 min ago
 * Runs every 5 minutes
 */
async function handleNoShows() {
  try {
    const cutoff = new Date(Date.now() - 10 * 60 * 1000); // 10 min ago

    // Find confirmed bookings for slots that started more than 10 min ago
    const overdueSlots = await Slot.find({ startTime: { $lte: cutoff } }).select('_id').lean();
    if (overdueSlots.length === 0) return;

    const slotIds = overdueSlots.map((s) => s._id);
    const noShows = await Booking.find({
      slotId: { $in: slotIds },
      status: 'confirmed',
    }).lean();

    for (const booking of noShows) {
      await Booking.findByIdAndUpdate(booking._id, {
        $set: { status: 'no_show', noShowAt: new Date() },
      });

      // Release slot
      await Slot.findOneAndUpdate(
        { _id: booking.slotId, booked: { $gt: 0 } },
        { $inc: { booked: -1 } }
      );

      // Penalize user
      const user = await User.findByIdAndUpdate(
        booking.userId,
        {
          $inc: { noShowCount: 1 },
          $max: { trustScore: 0 },
        },
        { new: true }
      );

      if (user) {
        const newScore = Math.max(0, (user.trustScore || 100) - 10);
        await User.findByIdAndUpdate(user._id, {
          $set: {
            trustScore: newScore,
            isBlocked: user.noShowCount >= 3,
          },
        });
      }
    }

    if (noShows.length > 0) {
      console.log(`[Cron] Marked ${noShows.length} bookings as no_show`);
    }
  } catch (err) {
    console.error('[Cron][handleNoShows]', err.message);
  }
}

/**
 * Expire old slots (past end_time)
 * Runs every hour
 */
async function expireOldSlots() {
  try {
    const result = await Slot.updateMany(
      { endTime: { $lt: new Date() }, isActive: true },
      { $set: { isActive: false } }
    );
    if (result.modifiedCount > 0) {
      console.log(`[Cron] Expired ${result.modifiedCount} slots`);
    }
  } catch (err) {
    console.error('[Cron][expireOldSlots]', err.message);
  }
}

/**
 * Generate slots for the next 7 days for all active pumps
 * Runs at midnight daily
 */
async function generateFutureSlots() {
  try {
    const pumps = await Pump.find({ isActive: true }).lean();
    await generateSlotsForAllPumps(pumps, 7);
    console.log(`[Cron] Generated slots for ${pumps.length} pumps (7 days)`);
  } catch (err) {
    console.error('[Cron][generateFutureSlots]', err.message);
  }
}

function startCronJobs() {
  // No-show handler — every 5 minutes
  setInterval(handleNoShows, 5 * 60 * 1000);

  // Expire slots — every hour
  setInterval(expireOldSlots, 60 * 60 * 1000);

  // Generate future slots — every 24 hours
  setInterval(generateFutureSlots, 24 * 60 * 60 * 1000);

  console.log('[Cron] Jobs started: no-show(5min), expire(1hr), generate(24hr)');
}

module.exports = { startCronJobs, handleNoShows, expireOldSlots };
