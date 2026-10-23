-- Trust Score: append-only ledger + atomic scoring function.
-- Run manually in the Supabase SQL editor (no migration runner is wired up).
-- Safe to re-run.
--
-- * Existing users keep their current trust_score. Only the DEFAULT for newly
--   created users changes (100 -> 80).
-- * All score changes go through public.apply_trust_event(), which locks the
--   user row, enforces idempotency, clamps to 0..100 and writes the ledger
--   entry in a single transaction. The Node backend (service role) is the
--   only caller; clients cannot reach the table (RLS on, no policies).

ALTER TABLE public.users ALTER COLUMN trust_score SET DEFAULT 80;

CREATE TABLE IF NOT EXISTS public.trust_score_events (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES public.users(id),
  booking_id       UUID REFERENCES public.bookings(id),
  event_type       TEXT NOT NULL
                     CHECK (event_type IN ('cancellation', 'no_show', 'dispute_reversal')),
  requested_delta  INTEGER NOT NULL,
  applied_delta    INTEGER NOT NULL,           -- after clamping to 0..100
  score_before     INTEGER NOT NULL CHECK (score_before BETWEEN 0 AND 100),
  score_after      INTEGER NOT NULL CHECK (score_after  BETWEEN 0 AND 100),
  reason           TEXT,
  actor_id         UUID,                       -- who triggered it (operator / admin / customer)
  idempotency_key  TEXT NOT NULL,
  reversal_of      UUID REFERENCES public.trust_score_events(id),
  metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_trust_events_idem
  ON public.trust_score_events (idempotency_key);
-- A booking can be penalised at most once per event type.
CREATE UNIQUE INDEX IF NOT EXISTS uq_trust_events_booking_type
  ON public.trust_score_events (booking_id, event_type)
  WHERE event_type IN ('cancellation', 'no_show');
-- An event can be reversed at most once.
CREATE UNIQUE INDEX IF NOT EXISTS uq_trust_events_reversal
  ON public.trust_score_events (reversal_of)
  WHERE reversal_of IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trust_events_user_time
  ON public.trust_score_events (user_id, created_at DESC);

ALTER TABLE public.trust_score_events ENABLE ROW LEVEL SECURITY;  -- no policies: service role only

-- Ledger rows are never edited or removed; corrections are new rows.
CREATE OR REPLACE FUNCTION public.trust_events_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'trust_score_events is append-only';
END;
$$;
DROP TRIGGER IF EXISTS trg_trust_events_immutable ON public.trust_score_events;
CREATE TRIGGER trg_trust_events_immutable
  BEFORE UPDATE OR DELETE ON public.trust_score_events
  FOR EACH ROW EXECUTE FUNCTION public.trust_events_immutable();

CREATE OR REPLACE FUNCTION public.apply_trust_event(
  p_user_id         UUID,
  p_booking_id      UUID,
  p_event_type      TEXT,
  p_delta           INTEGER,
  p_idempotency_key TEXT,
  p_reason          TEXT DEFAULT NULL,
  p_actor_id        UUID DEFAULT NULL,
  p_reversal_of     UUID DEFAULT NULL,
  p_metadata        JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_before   INTEGER;
  v_after    INTEGER;
  v_delta    INTEGER := p_delta;
  v_existing public.trust_score_events;
  v_orig     public.trust_score_events;
  v_row      public.trust_score_events;
BEGIN
  -- Serialise all scoring for this user.
  SELECT trust_score INTO v_before FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND';
  END IF;

  SELECT * INTO v_existing FROM public.trust_score_events WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object('applied', false, 'duplicate', true,
                              'event', to_jsonb(v_existing), 'score', v_before);
  END IF;

  IF p_event_type = 'dispute_reversal' THEN
    SELECT * INTO v_orig FROM public.trust_score_events WHERE id = p_reversal_of FOR UPDATE;
    IF NOT FOUND OR v_orig.user_id <> p_user_id THEN
      RAISE EXCEPTION 'EVENT_NOT_FOUND';
    END IF;
    IF v_orig.event_type = 'dispute_reversal' THEN
      RAISE EXCEPTION 'CANNOT_REVERSE_A_REVERSAL';
    END IF;
    IF EXISTS (SELECT 1 FROM public.trust_score_events WHERE reversal_of = v_orig.id) THEN
      RAISE EXCEPTION 'ALREADY_REVERSED';
    END IF;
    v_delta := -v_orig.applied_delta;   -- give back exactly what was taken
    p_booking_id := v_orig.booking_id;
  ELSIF p_booking_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.trust_score_events
    WHERE booking_id = p_booking_id
      AND event_type IN ('cancellation', 'no_show')
      AND event_type <> p_event_type
  ) THEN
    -- A booking is either cancelled or a no-show, never both.
    RAISE EXCEPTION 'BOOKING_ALREADY_RESOLVED';
  END IF;

  v_after := GREATEST(0, LEAST(100, v_before + v_delta));

  INSERT INTO public.trust_score_events
    (user_id, booking_id, event_type, requested_delta, applied_delta,
     score_before, score_after, reason, actor_id, idempotency_key, reversal_of, metadata)
  VALUES
    (p_user_id, p_booking_id, p_event_type, v_delta, v_after - v_before,
     v_before, v_after, p_reason, p_actor_id, p_idempotency_key, p_reversal_of,
     COALESCE(p_metadata, '{}'::jsonb))
  RETURNING * INTO v_row;

  UPDATE public.users
  SET trust_score = v_after,
      no_show_count = GREATEST(0, no_show_count
        + CASE
            WHEN p_event_type = 'no_show' THEN 1
            WHEN p_event_type = 'dispute_reversal' AND v_orig.event_type = 'no_show' THEN -1
            ELSE 0
          END)
  WHERE id = p_user_id;

  RETURN jsonb_build_object('applied', true, 'duplicate', false,
                            'event', to_jsonb(v_row), 'score', v_after);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_trust_event(UUID, UUID, TEXT, INTEGER, TEXT, TEXT, UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;

-- The old job docked 10 points from every user whose confirmed booking merely
-- expired -- with no operator verification. No-shows are now confirmed by the
-- pump operator through the API, so this function becomes a harmless no-op
-- (kept so existing callers do not break).
CREATE OR REPLACE FUNCTION public.mark_no_shows() RETURNS INTEGER
LANGUAGE plpgsql AS $$
BEGIN
  RETURN 0;
END;
$$;
