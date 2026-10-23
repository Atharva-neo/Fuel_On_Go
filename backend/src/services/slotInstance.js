const { supabase } = require('../config/supabase');
const { createSupabaseSlotStore } = require('./slotStoreSupabase');

module.exports = { slotStore: createSupabaseSlotStore(supabase) };
