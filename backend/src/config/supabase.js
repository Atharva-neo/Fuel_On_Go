const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey  = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl) {
  throw new Error('SUPABASE_URL is missing from .env');
}
if (!serviceKey || serviceKey.includes('YOUR_')) {
  throw new Error(
    'SUPABASE_SERVICE_KEY is not set in the backend environment'
  );
}

// Admin client — uses service_role key, bypasses RLS
// NEVER expose this key to the mobile app
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession:   false,
  },
});

module.exports = { supabase };
