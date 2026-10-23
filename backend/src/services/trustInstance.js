const { supabase } = require('../config/supabase');
const { createTrustService } = require('./trustScoreService');
const { createSupabaseTrustStore } = require('./trustStoreSupabase');

module.exports = { trust: createTrustService({ store: createSupabaseTrustStore(supabase) }) };
