-- Adds 'pending' (awaiting pump-owner approval) and 'rejected' to the set
-- of allowed booking statuses. Bookings now start as 'pending' when a
-- vehicle owner requests a slot, and the pump owner explicitly approves
-- (-> 'confirmed') or rejects (-> 'rejected') the request.
--
-- Run this manually in the Supabase SQL editor -- no automated migration
-- runner is wired up for this project.

ALTER TABLE public.bookings DROP CONSTRAINT bookings_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('pending', 'confirmed', 'arrived', 'no_show', 'cancelled', 'rejected'));
