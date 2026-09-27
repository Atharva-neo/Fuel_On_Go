-- =============================================================
-- Fuel on Go — Supabase Schema (v3 — fully idempotent)
-- Safe to run multiple times in Supabase SQL Editor
-- Project: aeadqckjwjchetzhupjd
-- =============================================================

-- ─── EXTENSIONS ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── USERS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone          TEXT UNIQUE NOT NULL,
  name           TEXT NOT NULL DEFAULT '',
  vehicle_number TEXT NOT NULL DEFAULT '',
  vehicle_type   TEXT NOT NULL DEFAULT 'Car'
                   CHECK (vehicle_type IN ('Car','Auto','Bus','Other')),
  role           TEXT NOT NULL DEFAULT 'user'
                   CHECK (role IN ('user','pump_owner','admin')),
  trust_score    INTEGER NOT NULL DEFAULT 100
                   CHECK (trust_score BETWEEN 0 AND 100),
  no_show_count  INTEGER NOT NULL DEFAULT 0,
  is_blocked     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_self_read"        ON public.users;
DROP POLICY IF EXISTS "users_self_update"      ON public.users;
DROP POLICY IF EXISTS "users_insert_own"       ON public.users;
DROP POLICY IF EXISTS "admin_read_all_users"   ON public.users;

CREATE POLICY "users_self_read"   ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_self_update" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "users_insert_own"  ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
-- Service-role backend bypasses RLS; this policy is for direct client access only
CREATE POLICY "admin_read_all_users" ON public.users FOR SELECT USING (auth.uid() = id);

-- ─── PUMPS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pumps (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id             UUID REFERENCES public.users(id),
  -- FIX: UNIQUE on name so ON CONFLICT (name) works in the seed INSERT
  name                 TEXT NOT NULL CONSTRAINT uq_pump_name UNIQUE,
  address              TEXT NOT NULL DEFAULT '',
  city                 TEXT NOT NULL DEFAULT '',
  district             TEXT NOT NULL DEFAULT '',
  state                TEXT NOT NULL DEFAULT 'Maharashtra',
  lat                  DOUBLE PRECISION NOT NULL,
  lng                  DOUBLE PRECISION NOT NULL,
  working_hours_start  TEXT NOT NULL DEFAULT '06:00',
  working_hours_end    TEXT NOT NULL DEFAULT '22:00',
  cng_price_per_kg     NUMERIC(8,2)  NOT NULL DEFAULT 89.00,
  fuel_density         NUMERIC(4,3)  NOT NULL DEFAULT 0.75,
  vehicles_per_slot    INTEGER       NOT NULL DEFAULT 5,
  supply_status        TEXT NOT NULL DEFAULT 'available'
                         CHECK (supply_status IN ('available','low','interrupted')),
  public_message       TEXT,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  is_verified          BOOLEAN NOT NULL DEFAULT FALSE,
  rating               NUMERIC(3,2) DEFAULT 4.0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.pumps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pumps_public_read"  ON public.pumps;
DROP POLICY IF EXISTS "owner_update_pump"  ON public.pumps;
DROP POLICY IF EXISTS "admin_all_pumps"    ON public.pumps;

CREATE POLICY "pumps_public_read" ON public.pumps FOR SELECT USING (is_active = TRUE);
CREATE POLICY "owner_update_pump" ON public.pumps FOR UPDATE USING (owner_id = auth.uid());
-- Admins use the service_role key (bypasses RLS) — no special JWT claim needed
CREATE POLICY "admin_all_pumps"   ON public.pumps FOR ALL   USING (owner_id = auth.uid());

-- ─── SHARED updated_at TRIGGER FUNCTION ──────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- FIX: DROP before CREATE — triggers have no CREATE OR REPLACE
DROP TRIGGER IF EXISTS pumps_updated_at ON public.pumps;
CREATE TRIGGER pumps_updated_at
  BEFORE UPDATE ON public.pumps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── SLOTS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.slots (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pump_id             UUID NOT NULL REFERENCES public.pumps(id) ON DELETE CASCADE,
  slot_date           DATE NOT NULL,
  start_time          TIME NOT NULL,
  end_time            TIME NOT NULL,
  capacity            INTEGER NOT NULL DEFAULT 5,
  booked_count        INTEGER NOT NULL DEFAULT 0,
  is_deactivated      BOOLEAN NOT NULL DEFAULT FALSE,
  deactivation_reason TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_slot_pump_date_start UNIQUE (pump_id, slot_date, start_time),
  CONSTRAINT chk_booked_lte_capacity CHECK (booked_count <= capacity),
  CONSTRAINT chk_booked_non_negative CHECK (booked_count >= 0)
);
ALTER TABLE public.slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "slots_auth_read"      ON public.slots;
DROP POLICY IF EXISTS "owner_update_slots"   ON public.slots;
DROP POLICY IF EXISTS "admin_all_slots"      ON public.slots;

CREATE POLICY "slots_auth_read"    ON public.slots FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "owner_update_slots" ON public.slots FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.pumps p WHERE p.id = pump_id AND p.owner_id = auth.uid()
  ));
CREATE POLICY "admin_all_slots" ON public.slots FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.pumps p WHERE p.id = pump_id AND p.owner_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_slots_pump_date ON public.slots (pump_id, slot_date);

-- ─── BOOKINGS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bookings (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID NOT NULL REFERENCES public.users(id),
  pump_id              UUID NOT NULL REFERENCES public.pumps(id),
  slot_id              UUID NOT NULL REFERENCES public.slots(id),
  slot_date            DATE NOT NULL,
  slot_start           TIME NOT NULL,
  slot_end             TIME NOT NULL,
  status               TEXT NOT NULL DEFAULT 'confirmed'
                         CHECK (status IN ('confirmed','arrived','no_show','cancelled')),
  qr_token             TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(12), 'hex'),
  booking_fee          NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_estimated      NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_paid_now      NUMERIC(10,2) NOT NULL DEFAULT 0,
  pending_amount       NUMERIC(10,2) NOT NULL DEFAULT 0,
  fuel_payment_method  TEXT NOT NULL DEFAULT 'cash'
                         CHECK (fuel_payment_method IN ('cash','upi','decided_later')),
  payment_option       TEXT NOT NULL DEFAULT 'partial'
                         CHECK (payment_option IN ('partial','full')),
  cancellation_reason  TEXT,
  refund_amount        NUMERIC(10,2) DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bookings_user_read"         ON public.bookings;
DROP POLICY IF EXISTS "bookings_user_insert"       ON public.bookings;
DROP POLICY IF EXISTS "bookings_user_cancel"       ON public.bookings;
DROP POLICY IF EXISTS "owner_read_pump_bookings"   ON public.bookings;
DROP POLICY IF EXISTS "admin_all_bookings"         ON public.bookings;

CREATE POLICY "bookings_user_read"   ON public.bookings FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "bookings_user_insert" ON public.bookings FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "bookings_user_cancel" ON public.bookings FOR UPDATE
  USING (user_id = auth.uid() AND status = 'confirmed');
CREATE POLICY "owner_read_pump_bookings" ON public.bookings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.pumps p WHERE p.id = pump_id AND p.owner_id = auth.uid()
  ));
CREATE POLICY "admin_all_bookings" ON public.bookings FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.pumps p WHERE p.id = pump_id AND p.owner_id = auth.uid()
  ));

DROP TRIGGER IF EXISTS bookings_updated_at ON public.bookings;
CREATE TRIGGER bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_bookings_user ON public.bookings (user_id, slot_date DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_pump ON public.bookings (pump_id, slot_date);
CREATE INDEX IF NOT EXISTS idx_bookings_qr   ON public.bookings (qr_token);
CREATE INDEX IF NOT EXISTS idx_bookings_slot ON public.bookings (slot_id);

-- ─── FUNCTION: book_slot (atomic) ────────────────────────────
CREATE OR REPLACE FUNCTION public.book_slot(
  p_user_id          UUID,
  p_pump_id          UUID,
  p_slot_id          UUID,
  p_slot_date        DATE,
  p_slot_start       TIME,
  p_slot_end         TIME,
  p_booking_fee      NUMERIC,
  p_total_estimated  NUMERIC,
  p_amount_paid_now  NUMERIC,
  p_pending_amount   NUMERIC,
  p_fuel_method      TEXT,
  p_payment_option   TEXT
) RETURNS public.bookings LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_booking public.bookings;
  v_slot    public.slots;
BEGIN
  SELECT * INTO v_slot FROM public.slots WHERE id = p_slot_id FOR UPDATE;
  IF NOT FOUND       THEN RAISE EXCEPTION 'Slot not found'; END IF;
  IF v_slot.booked_count >= v_slot.capacity THEN RAISE EXCEPTION 'Slot is full'; END IF;
  IF v_slot.is_deactivated THEN RAISE EXCEPTION 'Slot is deactivated'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE slot_id = p_slot_id AND user_id = p_user_id AND status <> 'cancelled'
  ) THEN RAISE EXCEPTION 'Already booked this slot'; END IF;

  UPDATE public.slots SET booked_count = booked_count + 1 WHERE id = p_slot_id;

  INSERT INTO public.bookings (
    user_id, pump_id, slot_id, slot_date, slot_start, slot_end,
    booking_fee, total_estimated, amount_paid_now, pending_amount,
    fuel_payment_method, payment_option
  ) VALUES (
    p_user_id, p_pump_id, p_slot_id, p_slot_date, p_slot_start, p_slot_end,
    p_booking_fee, p_total_estimated, p_amount_paid_now, p_pending_amount,
    p_fuel_method, p_payment_option
  ) RETURNING * INTO v_booking;

  RETURN v_booking;
END;
$$;

-- ─── FUNCTION: cancel_booking ────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_booking(
  p_booking_id UUID,
  p_user_id    UUID,
  p_refund     NUMERIC DEFAULT 0
) RETURNS public.bookings LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_booking public.bookings;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
  IF v_booking.user_id <> p_user_id THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF v_booking.status <> 'confirmed' THEN
    RAISE EXCEPTION 'Cannot cancel a % booking', v_booking.status;
  END IF;

  UPDATE public.bookings
  SET    status = 'cancelled', refund_amount = p_refund, updated_at = NOW()
  WHERE  id = p_booking_id
  RETURNING * INTO v_booking;

  UPDATE public.slots
  SET    booked_count = GREATEST(0, booked_count - 1)
  WHERE  id = v_booking.slot_id;

  RETURN v_booking;
END;
$$;

-- ─── FUNCTION: checkin_booking ───────────────────────────────
CREATE OR REPLACE FUNCTION public.checkin_booking(
  p_qr_token TEXT,
  p_admin_id UUID
) RETURNS public.bookings LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_booking public.bookings;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = p_admin_id AND role IN ('admin','pump_owner')
  ) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE qr_token = p_qr_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid QR token'; END IF;
  IF v_booking.status = 'arrived'   THEN RAISE EXCEPTION 'Already checked in'; END IF;
  IF v_booking.status <> 'confirmed' THEN RAISE EXCEPTION 'Booking is %', v_booking.status; END IF;

  UPDATE public.bookings SET status = 'arrived', updated_at = NOW()
  WHERE id = v_booking.id RETURNING * INTO v_booking;

  RETURN v_booking;
END;
$$;

-- ─── FUNCTION: generate_daily_slots ─────────────────────────
CREATE OR REPLACE FUNCTION public.generate_daily_slots(
  p_pump_id UUID,
  p_date    DATE DEFAULT CURRENT_DATE
) RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pump       public.pumps;
  v_current    TIME;
  v_slot_end   TIME;
  v_end_time   TIME;
  v_count      INTEGER := 0;
  v_inserted   INTEGER;
BEGIN
  SELECT * INTO v_pump FROM public.pumps WHERE id = p_pump_id AND is_active = TRUE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pump not found: %', p_pump_id; END IF;

  v_current  := v_pump.working_hours_start::TIME;
  v_end_time := v_pump.working_hours_end::TIME;

  WHILE v_current < v_end_time LOOP
    v_slot_end := v_current + INTERVAL '35 minutes';
    EXIT WHEN v_slot_end > v_end_time;

    INSERT INTO public.slots (pump_id, slot_date, start_time, end_time, capacity)
    VALUES (p_pump_id, p_date, v_current, v_slot_end, v_pump.vehicles_per_slot)
    ON CONFLICT (pump_id, slot_date, start_time) DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    v_count   := v_count + v_inserted;
    v_current := v_slot_end;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ─── FUNCTION: mark_no_shows ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_no_shows()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  UPDATE public.bookings b
  SET    status = 'no_show', updated_at = NOW()
  FROM   public.slots s
  WHERE  b.slot_id = s.id
    AND  b.status  = 'confirmed'
    AND  (b.slot_date::TEXT || ' ' || s.end_time::TEXT)::TIMESTAMPTZ
         < NOW() - INTERVAL '30 minutes';

  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.users u
  SET    trust_score   = GREATEST(0, trust_score - 10),
         no_show_count = no_show_count + 1
  WHERE  u.id IN (
    SELECT DISTINCT b.user_id FROM public.bookings b
    WHERE  b.status = 'no_show' AND b.updated_at > NOW() - INTERVAL '5 minutes'
  );

  RETURN v_count;
END;
$$;

-- ─── SEED: 14 Maharashtra CNG pumps ─────────────────────────
-- ON CONFLICT (name) works because name has UNIQUE constraint above
INSERT INTO public.pumps
  (name, address, city, district, lat, lng,
   cng_price_per_kg, fuel_density, vehicles_per_slot,
   is_active, is_verified, rating)
VALUES
  ('HP CNG Kolhapur Central',      'Station Road, Kolhapur',            'Kolhapur',   'Kolhapur',   16.7028, 74.2317, 89.50, 0.760, 5, TRUE, TRUE, 4.3),
  ('Bharat CNG Kolhapur Tarabai',  'Tarabai Park, Kolhapur',            'Kolhapur',   'Kolhapur',   16.7200, 74.2450, 88.00, 0.750, 5, TRUE, TRUE, 4.0),
  ('IndianOil CNG Pune Kothrud',   'Karve Road, Kothrud, Pune',         'Pune',       'Pune',       18.5070, 73.8077, 91.20, 0.770, 5, TRUE, TRUE, 4.5),
  ('HP CNG Pune Hinjewadi',        'Hinjewadi IT Park Road, Pune',      'Pune',       'Pune',       18.5913, 73.7387, 91.50, 0.750, 5, TRUE, TRUE, 3.8),
  ('MGL CNG Andheri East',         'MIDC Road, Andheri East, Mumbai',   'Mumbai',     'Mumbai',     19.1136, 72.8697, 94.00, 0.760, 5, TRUE, TRUE, 4.2),
  ('Bharat CNG Thane West',        'Pokhran Road No 1, Thane West',     'Thane',      'Thane',      19.2094, 72.9711, 93.50, 0.740, 5, TRUE, TRUE, 3.9),
  ('CNG Nagpur Sitabuldi',         'Central Avenue, Sitabuldi, Nagpur', 'Nagpur',     'Nagpur',     21.1458, 79.0882, 86.00, 0.760, 5, TRUE, TRUE, 4.4),
  ('HP CNG Nashik Road',           'Nashik Road, Nashik',               'Nashik',     'Nashik',     19.9975, 73.7898, 88.50, 0.750, 5, TRUE, TRUE, 4.1),
  ('IndianOil CNG Aurangabad',     'Jalna Road, Aurangabad',            'Aurangabad', 'Aurangabad', 19.8762, 75.3433, 87.50, 0.750, 5, TRUE, TRUE, 4.0),
  ('CNG Solapur Station',          'Railway Station Road, Solapur',     'Solapur',    'Solapur',    17.6805, 75.9064, 87.00, 0.730, 5, TRUE, TRUE, 3.7),
  ('Bharat CNG Sangli Vishrambag', 'Vishrambag, Sangli',                'Sangli',     'Sangli',     16.8524, 74.5815, 88.00, 0.750, 5, TRUE, TRUE, 4.2),
  ('HP CNG Satara City',           'Shivaji Chowk, Satara',             'Satara',     'Satara',     17.6868, 73.9945, 88.00, 0.750, 4, TRUE, TRUE, 3.9),
  ('CNG Nanded Gurudwara Road',    'Gurudwara Road, Nanded',            'Nanded',     'Nanded',     19.1383, 77.3210, 86.50, 0.740, 5, TRUE, TRUE, 4.0),
  ('IndianOil CNG Latur',          'Main Road, Latur',                  'Latur',      'Latur',      18.4088, 76.5604, 86.00, 0.740, 5, TRUE, TRUE, 3.8)
ON CONFLICT (name) DO NOTHING;

-- ─── VIEW: pump_availability ─────────────────────────────────
DROP VIEW IF EXISTS public.pump_availability;
CREATE VIEW public.pump_availability AS
SELECT
  p.id,
  p.name,
  p.address,
  p.city,
  p.district,
  p.lat,
  p.lng,
  p.cng_price_per_kg,
  p.fuel_density,
  p.vehicles_per_slot,
  p.working_hours_start,
  p.working_hours_end,
  p.supply_status,
  p.public_message,
  p.rating,
  p.is_active,
  COALESCE((
    SELECT SUM(s.capacity - s.booked_count)
    FROM   public.slots s
    WHERE  s.pump_id        = p.id
      AND  s.slot_date      = CURRENT_DATE
      AND  s.is_deactivated = FALSE
      AND  (s.slot_date::TEXT || ' ' || s.start_time::TEXT)::TIMESTAMPTZ > NOW()
  ), 0)::INTEGER AS available_slots_today,
  CASE
    WHEN COALESCE((
      SELECT SUM(s.capacity - s.booked_count)
      FROM   public.slots s
      WHERE  s.pump_id   = p.id AND s.slot_date = CURRENT_DATE
        AND  NOT s.is_deactivated
        AND  (s.slot_date::TEXT || ' ' || s.start_time::TEXT)::TIMESTAMPTZ > NOW()
    ), 0) > 10 THEN 'high'
    WHEN COALESCE((
      SELECT SUM(s.capacity - s.booked_count)
      FROM   public.slots s
      WHERE  s.pump_id   = p.id AND s.slot_date = CURRENT_DATE
        AND  NOT s.is_deactivated
        AND  (s.slot_date::TEXT || ' ' || s.start_time::TEXT)::TIMESTAMPTZ > NOW()
    ), 0) > 0  THEN 'medium'
    ELSE 'low'
  END AS status
FROM public.pumps p
WHERE p.is_active = TRUE;

GRANT SELECT ON public.pump_availability TO authenticated;
GRANT SELECT ON public.pump_availability TO anon;
GRANT SELECT ON public.pumps             TO authenticated;
GRANT SELECT ON public.pumps             TO anon;
GRANT SELECT ON public.slots             TO authenticated;
