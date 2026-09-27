-- Migration to add missing columns to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS expo_push_token TEXT;

-- Refresh PostgREST cache
NOTIFY pgrst, 'reload schema';
