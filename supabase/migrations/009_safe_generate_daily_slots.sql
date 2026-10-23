-- Optional hardening. Slot generation now runs in the Node backend (src/services/slotGenerator.js)
-- from each pump's SAVED hours, so nothing in the app calls generate_daily_slots() any more.
--
-- The original SQL function was unsafe for the schedules owners can now save:
--   * it added 35 minutes to a TIME value, which wraps past midnight, so for a 22:00-24:00 pump
--     the loop never reached its end;
--   * it used 35-minute slots while the rest of the app uses 30.
-- This replacement uses integer minutes, 30-minute slots, supports a 24:00 closing time and
-- overnight schedules, and always terminates. Run it once in the Supabase SQL editor. Safe to re-run.

CREATE OR REPLACE FUNCTION public.generate_daily_slots(
  p_pump_id UUID,
  p_date    DATE DEFAULT CURRENT_DATE
) RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pump     public.pumps;
  v_open     INTEGER;
  v_close    INTEGER;
  v_start    INTEGER;
  v_count    INTEGER := 0;
  v_inserted INTEGER;
  v_dur      CONSTANT INTEGER := 30;
  v_win      INTEGER[][];
  w_start    INTEGER;
  w_end      INTEGER;
  i          INTEGER;
BEGIN
  SELECT * INTO v_pump FROM public.pumps WHERE id = p_pump_id AND is_active = TRUE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pump not found: %', p_pump_id; END IF;

  v_open  := split_part(v_pump.working_hours_start, ':', 1)::INTEGER * 60 + split_part(v_pump.working_hours_start, ':', 2)::INTEGER;
  v_close := split_part(v_pump.working_hours_end,   ':', 1)::INTEGER * 60 + split_part(v_pump.working_hours_end,   ':', 2)::INTEGER;
  IF v_close = 0 AND v_open > 0 THEN v_close := 1440; END IF;       -- "00:00" closing = midnight
  IF v_open = v_close THEN RAISE EXCEPTION 'Opening and closing time are the same'; END IF;

  IF v_close < v_open THEN
    v_win := ARRAY[[0, v_close], [v_open, 1440]];                    -- overnight: two windows per calendar day
  ELSE
    v_win := ARRAY[[v_open, v_close]];
  END IF;

  FOR i IN 1 .. array_length(v_win, 1) LOOP
    w_start := v_win[i][1];
    w_end   := v_win[i][2];
    v_start := w_start;
    WHILE v_start + v_dur <= w_end LOOP
      INSERT INTO public.slots (pump_id, slot_date, start_time, end_time, capacity)
      VALUES (
        p_pump_id, p_date,
        make_interval(mins => v_start)::TIME,
        CASE WHEN v_start + v_dur = 1440 THEN TIME '24:00:00' ELSE make_interval(mins => v_start + v_dur)::TIME END,
        v_pump.vehicles_per_slot
      )
      ON CONFLICT (pump_id, slot_date, start_time) DO NOTHING;
      GET DIAGNOSTICS v_inserted = ROW_COUNT;
      v_count := v_count + v_inserted;
      v_start := v_start + v_dur;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$;
