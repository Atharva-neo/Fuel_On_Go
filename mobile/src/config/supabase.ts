import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './constants';

export const supabase = createClient<Database>(
  SUPABASE_URL, 
  SUPABASE_ANON_KEY || 'missing-key',
  {
    auth: {
      autoRefreshToken:  true,
      persistSession:    true,
      detectSessionInUrl: false,
    },
  }
);

// Re-export for compatibility
export { API_URL } from './constants';
