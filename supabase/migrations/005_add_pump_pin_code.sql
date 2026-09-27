-- Pump registration sends pin_code; add the column it expects.
ALTER TABLE public.pumps ADD COLUMN IF NOT EXISTS pin_code TEXT;
NOTIFY pgrst, 'reload schema';
