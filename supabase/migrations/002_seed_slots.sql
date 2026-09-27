-- =====================================================
-- Generate slots for all active pumps for next 3 days
-- Run once after schema is applied
-- =====================================================

DO $$
DECLARE
  p RECORD;
  d INTEGER;
BEGIN
  FOR p IN SELECT id FROM public.pumps WHERE is_active = TRUE LOOP
    FOR d IN 0..2 LOOP
      PERFORM public.generate_daily_slots(p.id, CURRENT_DATE + d);
    END LOOP;
  END LOOP;
  RAISE NOTICE 'Slot generation complete';
END;
$$;
