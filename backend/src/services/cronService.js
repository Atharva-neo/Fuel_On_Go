/**
 * CronService — runs periodic tasks
 * - Every hour: make sure today + the next 6 days have slots (from each pump's saved hours)
 * No-shows are NOT marked automatically any more: they need pump-operator
 * verification (POST /api/bookings/:id/no-show), see trustScoreService.
 */
const { supabase } = require('../config/supabase');
const { slotStore } = require('./slotInstance');
const { ensureUpcoming } = require('./slotGenerator');

const ONE_HOUR = 60 * 60 * 1000;

async function generateUpcomingSlots() {
  try {
    const { data: pumps, error } = await supabase
      .from('pumps')
      .select('id, working_hours_start, working_hours_end, vehicles_per_slot')
      .eq('is_active', true);
    if (error) throw error;

    let total = 0;
    for (const pump of pumps || []) {
      try {
        const r = await ensureUpcoming({ store: slotStore, pump });
        total += r.created;
      } catch (err) {
        console.error(`[Cron] slots for pump ${pump.id}:`, err.message);
      }
    }
    if (total > 0) console.log(`[Cron] Generated ${total} slots`);
  } catch (err) {
    console.error('[Cron] generate slots error:', err.message);
  }
}

let intervals = [];

function start() {
  if (intervals.length) return;

  // Run immediately on boot
  generateUpcomingSlots();

  // Then schedule
  intervals = [
    setInterval(generateUpcomingSlots, ONE_HOUR),
  ];

  console.log('[Cron] Service started');
}

function stop() {
  intervals.forEach(clearInterval);
  intervals = [];
}

module.exports = { start, stop };
