/**
 * CronService — runs periodic tasks
 * - Every hour: generate slots for tomorrow if not yet created
 * - Every 5 minutes: mark expired confirmed bookings as no_show
 */
const { supabase } = require('../config/supabase');

const FIVE_MIN = 5 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

async function markNoShows() {
  try {
    const { data, error } = await supabase.rpc('mark_no_shows');
    if (error) throw error;
    if (data > 0) console.log(`[Cron] Marked ${data} no-shows`);
  } catch (err) {
    console.error('[Cron] mark_no_shows error:', err.message);
  }
}

async function generateTomorrowSlots() {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const { data: pumps } = await supabase
      .from('pumps')
      .select('id')
      .eq('is_active', true);

    let total = 0;
    for (const pump of (pumps || [])) {
      const { data } = await supabase.rpc('generate_daily_slots', {
        p_pump_id: pump.id,
        p_date: tomorrowStr,
      });
      total += data || 0;
    }

    if (total > 0) console.log(`[Cron] Generated ${total} slots for ${tomorrowStr}`);
  } catch (err) {
    console.error('[Cron] generate slots error:', err.message);
  }
}

let intervals = [];

function start() {
  if (intervals.length) return;

  // Run immediately on boot
  markNoShows();
  generateTomorrowSlots();

  // Then schedule
  intervals = [
    setInterval(markNoShows, FIVE_MIN),
    setInterval(generateTomorrowSlots, ONE_HOUR),
  ];

  console.log('[Cron] Service started');
}

function stop() {
  intervals.forEach(clearInterval);
  intervals = [];
}

module.exports = { start, stop };
