-- Verified-visit pump ratings. Run manually in the Supabase SQL editor. Safe to re-run.
--
-- A rating belongs to ONE completed booking (status 'arrived' = the pump
-- operator scanned the customer's QR). The pump is taken from the booking,
-- never from the request. UNIQUE(booking_id) + a row lock on the booking make
-- "one rating per visit" hold under retries and concurrent taps.
--
-- The old, unlinked `ratings` table (if it exists in your project) is left
-- untouched and no longer used: its rows have no booking, so they cannot be
-- shown as verified. Pump aggregates are recomputed from this table only.

ALTER TABLE public.pumps ADD COLUMN IF NOT EXISTS rating_avg   NUMERIC(3,2);        -- NULL = no reviews yet (never a default 4.0)
ALTER TABLE public.pumps ADD COLUMN IF NOT EXISTS rating_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.pump_ratings (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pump_id       UUID NOT NULL REFERENCES public.pumps(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.users(id),
  booking_id    UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  rating        SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review        TEXT CHECK (review IS NULL OR char_length(review) <= 1000),
  tags          TEXT[] NOT NULL DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'hidden')),
  hidden_reason TEXT,
  hidden_by     UUID REFERENCES public.users(id),
  hidden_at     TIMESTAMPTZ,
  edited_count  INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pump_ratings_booking ON public.pump_ratings (booking_id);
CREATE INDEX IF NOT EXISTS idx_pump_ratings_pump_visible
  ON public.pump_ratings (pump_id, created_at DESC) WHERE status = 'visible';
ALTER TABLE public.pump_ratings ENABLE ROW LEVEL SECURITY;      -- no policies: service role only

-- Owners cannot delete or edit reviews; they can only report one. The report
-- row (who, why, who resolved it, note, timestamps) is the audit trail.
CREATE TABLE IF NOT EXISTS public.pump_rating_reports (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rating_id       UUID NOT NULL REFERENCES public.pump_ratings(id) ON DELETE CASCADE,
  reporter_id     UUID NOT NULL REFERENCES public.users(id),
  reason          TEXT NOT NULL CHECK (char_length(reason) BETWEEN 5 AND 500),
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'upheld', 'dismissed')),
  resolved_by     UUID REFERENCES public.users(id),
  resolution_note TEXT,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_rating_report_once ON public.pump_rating_reports (rating_id, reporter_id);
ALTER TABLE public.pump_rating_reports ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.recompute_pump_rating(p_pump_id UUID) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.pumps p
  SET rating_count = s.c,
      rating_avg   = CASE WHEN s.c = 0 THEN NULL ELSE ROUND(s.a::NUMERIC, 2) END
  FROM (
    SELECT COUNT(*)::INTEGER AS c, AVG(rating) AS a
    FROM public.pump_ratings WHERE pump_id = p_pump_id AND status = 'visible'
  ) s
  WHERE p.id = p_pump_id;
END;
$$;

-- Create or edit the rating for one completed booking, atomically.
-- Errors (RAISE EXCEPTION codes): BOOKING_NOT_FOUND, NOT_YOUR_BOOKING,
-- NOT_COMPLETED, OWN_PUMP, EDIT_WINDOW_CLOSED.
CREATE OR REPLACE FUNCTION public.submit_pump_rating(
  p_user_id    UUID,
  p_booking_id UUID,
  p_rating     INTEGER,
  p_review     TEXT,
  p_tags       TEXT[]
) RETURNS JSONB
LANGUAGE plpgsql AS $$
DECLARE
  v_b        public.bookings;
  v_owner    UUID;
  v_existing public.pump_ratings;
  v_row      public.pump_ratings;
  v_created  BOOLEAN := FALSE;
  v_dup      BOOLEAN := FALSE;
BEGIN
  -- Serialises concurrent submissions for this booking.
  SELECT * INTO v_b FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND'; END IF;
  IF v_b.user_id <> p_user_id THEN RAISE EXCEPTION 'NOT_YOUR_BOOKING'; END IF;
  IF v_b.status <> 'arrived' THEN RAISE EXCEPTION 'NOT_COMPLETED'; END IF;

  SELECT owner_id INTO v_owner FROM public.pumps WHERE id = v_b.pump_id;
  IF v_owner IS NOT NULL AND v_owner = p_user_id THEN RAISE EXCEPTION 'OWN_PUMP'; END IF;

  SELECT * INTO v_existing FROM public.pump_ratings WHERE booking_id = p_booking_id;
  IF FOUND THEN
    IF v_existing.rating = p_rating
       AND COALESCE(v_existing.review, '') = COALESCE(p_review, '')
       AND v_existing.tags = COALESCE(p_tags, '{}') THEN
      v_dup := TRUE;                                   -- retry of the same submission
      v_row := v_existing;
    ELSE
      IF NOW() - v_existing.created_at > INTERVAL '7 days' THEN
        RAISE EXCEPTION 'EDIT_WINDOW_CLOSED';
      END IF;
      UPDATE public.pump_ratings
      SET rating = p_rating, review = p_review, tags = COALESCE(p_tags, '{}'),
          edited_count = edited_count + 1, updated_at = NOW()
      WHERE id = v_existing.id
      RETURNING * INTO v_row;
    END IF;
  ELSE
    INSERT INTO public.pump_ratings (pump_id, user_id, booking_id, rating, review, tags)
    VALUES (v_b.pump_id, p_user_id, p_booking_id, p_rating, p_review, COALESCE(p_tags, '{}'))
    RETURNING * INTO v_row;
    v_created := TRUE;
  END IF;

  PERFORM public.recompute_pump_rating(v_b.pump_id);

  RETURN jsonb_build_object(
    'rating', to_jsonb(v_row),
    'created', v_created,
    'duplicate', v_dup,
    'pump', (SELECT jsonb_build_object('id', id, 'rating_avg', rating_avg, 'rating_count', rating_count)
             FROM public.pumps WHERE id = v_b.pump_id)
  );
END;
$$;

-- Pump owner reports a review for moderation. Never changes the rating itself.
CREATE OR REPLACE FUNCTION public.report_pump_rating(p_owner_id UUID, p_rating_id UUID, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql AS $$
DECLARE
  v_pump_owner UUID;
  v_report     public.pump_rating_reports;
BEGIN
  SELECT p.owner_id INTO v_pump_owner
  FROM public.pump_ratings r JOIN public.pumps p ON p.id = r.pump_id
  WHERE r.id = p_rating_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'RATING_NOT_FOUND'; END IF;
  IF v_pump_owner IS DISTINCT FROM p_owner_id THEN RAISE EXCEPTION 'NOT_YOUR_PUMP'; END IF;

  INSERT INTO public.pump_rating_reports (rating_id, reporter_id, reason)
  VALUES (p_rating_id, p_owner_id, p_reason)
  ON CONFLICT (rating_id, reporter_id) DO NOTHING
  RETURNING * INTO v_report;

  IF v_report.id IS NULL THEN
    SELECT * INTO v_report FROM public.pump_rating_reports WHERE rating_id = p_rating_id AND reporter_id = p_owner_id;
    RETURN jsonb_build_object('report', to_jsonb(v_report), 'duplicate', TRUE);
  END IF;
  RETURN jsonb_build_object('report', to_jsonb(v_report), 'duplicate', FALSE);
END;
$$;

-- Admin decision on a report: 'uphold' hides the review (excluded from the
-- average and count; the row is kept), 'dismiss' leaves it visible.
CREATE OR REPLACE FUNCTION public.resolve_rating_report(p_admin_id UUID, p_report_id UUID, p_action TEXT, p_note TEXT)
RETURNS JSONB
LANGUAGE plpgsql AS $$
DECLARE
  v_report public.pump_rating_reports;
  v_rating public.pump_ratings;
BEGIN
  IF p_action NOT IN ('uphold', 'dismiss') THEN RAISE EXCEPTION 'BAD_ACTION'; END IF;
  SELECT * INTO v_report FROM public.pump_rating_reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'REPORT_NOT_FOUND'; END IF;
  IF v_report.status <> 'open' THEN RAISE EXCEPTION 'ALREADY_RESOLVED'; END IF;

  UPDATE public.pump_rating_reports
  SET status = CASE WHEN p_action = 'uphold' THEN 'upheld' ELSE 'dismissed' END,
      resolved_by = p_admin_id, resolution_note = p_note, resolved_at = NOW()
  WHERE id = p_report_id;

  IF p_action = 'uphold' THEN
    UPDATE public.pump_ratings
    SET status = 'hidden', hidden_reason = v_report.reason, hidden_by = p_admin_id, hidden_at = NOW(), updated_at = NOW()
    WHERE id = v_report.rating_id
    RETURNING * INTO v_rating;
    PERFORM public.recompute_pump_rating(v_rating.pump_id);
  END IF;

  RETURN jsonb_build_object('report_id', p_report_id, 'action', p_action);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_pump_rating(UUID, UUID, INTEGER, TEXT, TEXT[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.report_pump_rating(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_rating_report(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recompute_pump_rating(UUID) FROM PUBLIC, anon, authenticated;
