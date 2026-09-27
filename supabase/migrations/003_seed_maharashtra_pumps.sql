-- =============================================================
-- Fuel on Go - Maharashtra pump expansion + slot generation
-- Run in Supabase SQL Editor
-- =============================================================

-- 1) Remove duplicate pumps
DELETE FROM pumps a
USING pumps b
WHERE a.id > b.id
  AND a.name = b.name
  AND a.lat = b.lat
  AND a.lng = b.lng;

-- 2) Ensure unique location-level identity
ALTER TABLE pumps
DROP CONSTRAINT IF EXISTS unique_pump_location;

ALTER TABLE pumps
ADD CONSTRAINT unique_pump_location
UNIQUE (name, lat, lng);

-- 3) Seed pumps by district
-- Counts:
-- Kolhapur 50, Pune 50, Mumbai 50, Nagpur 40, Nashik 40, Aurangabad 40
-- Remaining districts 20 each
DO $$
DECLARE
  d RECORD;
  i INTEGER;
  v_spread NUMERIC;
  v_lat DOUBLE PRECISION;
  v_lng DOUBLE PRECISION;
  v_open TEXT;
  v_close TEXT;
  v_capacity INTEGER;
  v_price NUMERIC;
  v_density NUMERIC;
BEGIN
  FOR d IN
    WITH district_targets AS (
      SELECT * FROM (
        VALUES
          ('Mumbai',        'Mumbai',        19.0760, 72.8777, 50),
          ('Pune',          'Pune',          18.5204, 73.8567, 50),
          ('Kolhapur',      'Kolhapur',      16.7050, 74.2433, 50),
          ('Nagpur',        'Nagpur',        21.1458, 79.0882, 40),
          ('Nashik',        'Nashik',        19.9975, 73.7898, 40),
          ('Aurangabad',    'Aurangabad',    19.8762, 75.3433, 40),

          ('Mumbai Suburban','Mumbai Suburban',19.1334, 72.8422, 20),
          ('Thane',         'Thane',         19.2183, 72.9781, 20),
          ('Palghar',       'Palghar',       19.6967, 72.7699, 20),
          ('Raigad',        'Raigad',        18.5158, 73.1822, 20),
          ('Ratnagiri',     'Ratnagiri',     16.9902, 73.3120, 20),
          ('Sindhudurg',    'Sindhudurg',    16.1667, 73.5000, 20),
          ('Sangli',        'Sangli',        16.8524, 74.5815, 20),
          ('Satara',        'Satara',        17.6868, 73.9945, 20),
          ('Solapur',       'Solapur',       17.6599, 75.9064, 20),
          ('Ahmednagar',    'Ahmednagar',    19.0948, 74.7480, 20),
          ('Dhule',         'Dhule',         20.9042, 74.7749, 20),
          ('Jalgaon',       'Jalgaon',       21.0077, 75.5626, 20),
          ('Nandurbar',     'Nandurbar',     21.3667, 74.2400, 20),
          ('Jalna',         'Jalna',         19.8406, 75.8860, 20),
          ('Beed',          'Beed',          18.9891, 75.7601, 20),
          ('Osmanabad',     'Osmanabad',     18.1861, 76.0419, 20),
          ('Latur',         'Latur',         18.4088, 76.5604, 20),
          ('Nanded',        'Nanded',        19.1383, 77.3210, 20),
          ('Parbhani',      'Parbhani',      19.2608, 76.7748, 20),
          ('Hingoli',       'Hingoli',       19.7176, 77.1491, 20),
          ('Akola',         'Akola',         20.7096, 76.9981, 20),
          ('Amravati',      'Amravati',      20.9320, 77.7523, 20),
          ('Buldhana',      'Buldhana',      20.5333, 76.1833, 20),
          ('Washim',        'Washim',        20.1110, 77.1330, 20),
          ('Yavatmal',      'Yavatmal',      20.3890, 78.1300, 20),
          ('Wardha',        'Wardha',        20.7453, 78.6022, 20),
          ('Bhandara',      'Bhandara',      21.1700, 79.6500, 20),
          ('Gondia',        'Gondia',        21.4602, 80.1961, 20),
          ('Chandrapur',    'Chandrapur',    19.9615, 79.2961, 20),
          ('Gadchiroli',    'Gadchiroli',    19.9957, 80.1937, 20)
      ) AS t(city_name, district_name, center_lat, center_lng, target_count)
    )
    SELECT * FROM district_targets
  LOOP
    v_spread := CASE
      WHEN d.target_count >= 50 THEN 1.10
      WHEN d.target_count >= 40 THEN 0.90
      ELSE 0.60
    END;

    FOR i IN 1..d.target_count LOOP
      v_lat := ROUND((d.center_lat + ((RANDOM() - 0.5) * v_spread))::NUMERIC, 6)::DOUBLE PRECISION;
      v_lng := ROUND((d.center_lng + ((RANDOM() - 0.5) * v_spread))::NUMERIC, 6)::DOUBLE PRECISION;

      v_open := (ARRAY['06:00', '07:00', '08:00'])[1 + FLOOR(RANDOM() * 3)::INT];
      v_close := (ARRAY['20:00', '21:00', '22:00'])[1 + FLOOR(RANDOM() * 3)::INT];
      v_capacity := 3 + FLOOR(RANDOM() * 4)::INT;
      v_price := ROUND((88 + RANDOM() * 4)::NUMERIC, 2);
      v_density := ROUND((0.73 + RANDOM() * 0.04)::NUMERIC, 3);

      INSERT INTO pumps (
        name,
        address,
        city,
        district,
        state,
        lat,
        lng,
        working_hours_start,
        working_hours_end,
        vehicles_per_slot,
        is_active,
        is_verified,
        cng_price_per_kg,
        fuel_density
      )
      VALUES (
        FORMAT('HP CNG %s %s', d.district_name, i),
        FORMAT('Zone %s, %s, Maharashtra', i, d.city_name),
        d.city_name,
        d.district_name,
        'Maharashtra',
        v_lat,
        v_lng,
        v_open,
        v_close,
        v_capacity,
        TRUE,
        TRUE,
        v_price,
        v_density
      )
      ON CONFLICT (name, lat, lng) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- 4) Generate slots for active pumps that currently have no slots
DO $$
DECLARE
  p RECORD;
  day_offset INT;
  slot_count INT;
  has_generator BOOLEAN;
  has_status_col BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'generate_daily_slots'
  ) INTO has_generator;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'slots'
      AND column_name = 'status'
  ) INTO has_status_col;

  FOR p IN SELECT id, working_hours_start, working_hours_end, vehicles_per_slot FROM pumps WHERE is_active = TRUE LOOP
    SELECT COUNT(*) INTO slot_count
    FROM slots
    WHERE pump_id = p.id;

    IF slot_count = 0 THEN
      IF has_generator THEN
        FOR day_offset IN 0..6 LOOP
          PERFORM public.generate_daily_slots(p.id, CURRENT_DATE + day_offset);
        END LOOP;
      ELSE
        -- Fallback: manual slot generation (35-minute cycle, 30-minute slot + 5-minute buffer)
        FOR day_offset IN 0..6 LOOP
          IF has_status_col THEN
            INSERT INTO slots (pump_id, slot_date, start_time, end_time, capacity, booked_count, status)
            SELECT
              p.id,
              CURRENT_DATE + day_offset,
              gs::time,
              (gs + INTERVAL '30 minutes')::time,
              p.vehicles_per_slot,
              0,
              'open'
            FROM generate_series(
              (CURRENT_DATE + day_offset + p.working_hours_start::time)::timestamp,
              (CURRENT_DATE + day_offset + p.working_hours_end::time)::timestamp - INTERVAL '30 minutes',
              INTERVAL '35 minutes'
            ) AS gs
            ON CONFLICT DO NOTHING;
          ELSE
            INSERT INTO slots (pump_id, slot_date, start_time, end_time, capacity, booked_count)
            SELECT
              p.id,
              CURRENT_DATE + day_offset,
              gs::time,
              (gs + INTERVAL '30 minutes')::time,
              p.vehicles_per_slot,
              0
            FROM generate_series(
              (CURRENT_DATE + day_offset + p.working_hours_start::time)::timestamp,
              (CURRENT_DATE + day_offset + p.working_hours_end::time)::timestamp - INTERVAL '30 minutes',
              INTERVAL '35 minutes'
            ) AS gs
            ON CONFLICT DO NOTHING;
          END IF;
        END LOOP;
      END IF;
    END IF;
  END LOOP;
END $$;
