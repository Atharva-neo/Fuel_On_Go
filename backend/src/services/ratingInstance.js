const { supabase } = require('../config/supabase');
const { createRatingService } = require('./ratingService');
const { createSupabaseRatingStore } = require('./ratingStoreSupabase');

module.exports = { ratings: createRatingService({ store: createSupabaseRatingStore(supabase) }) };
