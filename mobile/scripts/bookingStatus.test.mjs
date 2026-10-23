// Run: npm run test:bookings
import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyBooking, bookingsForTab, slotEndMs } from '../src/utils/bookingStatus.ts';
import { rateActionState } from '../src/ratings/ratingModel.ts';

// "Now" = 2030-06-10 10:00 IST (04:30 UTC)
const NOW = new Date('2030-06-10T04:30:00Z');
const slot = (status, date, start, end) => ({ id: `${status}-${date}-${start}`, status, slot_date: date, slot_start: start, slot_end: end });
const FUTURE = ['2030-06-10', '14:00:00', '14:30:00'];
const PAST = ['2030-06-09', '10:00:00', '10:30:00'];
const tab = (status, when = FUTURE) => classifyBooking(slot(status, ...when), NOW).tab;

test('arrived / completed visits NEVER appear in Upcoming (the reported bug), whatever the date', () => {
  for (const when of [FUTURE, PAST, ['2030-06-10', '09:30:00', '10:00:00']]) {
    assert.equal(tab('arrived', when), 'completed', `arrived ${when}`);
    assert.equal(tab('completed', when), 'completed', `completed ${when}`);
  }
});

test('cancelled and rejected bookings appear only under Cancelled, even for future slots', () => {
  for (const status of ['cancelled', 'rejected']) {
    assert.equal(tab(status, FUTURE), 'cancelled');
    assert.equal(tab(status, PAST), 'cancelled');
  }
});

test('pending stays separate from confirmed inside Upcoming while the slot is still ahead', () => {
  const pending = classifyBooking(slot('pending', ...FUTURE), NOW);
  const confirmed = classifyBooking(slot('confirmed', ...FUTURE), NOW);
  assert.deepEqual([pending.tab, pending.label, pending.tone], ['upcoming', 'Pending Approval', 'amber']);
  assert.deepEqual([confirmed.tab, confirmed.label, confirmed.tone], ['upcoming', 'Confirmed', 'green']);
});

test('the clock only expires unresolved bookings; it never turns them into completed or cancelled', () => {
  const stalePending = classifyBooking(slot('pending', ...PAST), NOW);
  const staleConfirmed = classifyBooking(slot('confirmed', ...PAST), NOW);
  assert.equal(stalePending.label, 'Expired');
  assert.equal(staleConfirmed.label, 'Expired');
  assert.equal(stalePending.expired && staleConfirmed.expired, true);
  assert.notEqual(staleConfirmed.label, 'Completed');
  assert.notEqual(stalePending.label, 'Cancelled');
  assert.equal(staleConfirmed.tab, 'completed'); // history, labelled Expired
  assert.equal(stalePending.tab, 'cancelled');
});

test('no-show is history labelled No Show; unknown statuses are never guessed to be upcoming', () => {
  const ns = classifyBooking(slot('no_show', ...PAST), NOW);
  assert.deepEqual([ns.tab, ns.label], ['completed', 'No Show']);
  assert.notEqual(tab('mystery'), 'upcoming');
  assert.notEqual(tab(undefined), 'upcoming');
  assert.notEqual(tab(''), 'upcoming');
});

test('time boundaries in IST: a confirmed slot is upcoming until it ENDS, expired right after', () => {
  const b = slot('confirmed', '2030-06-10', '09:30:00', '10:30:00');
  assert.equal(classifyBooking(b, new Date('2030-06-10T05:00:00Z')).tab, 'upcoming'); // 10:30 IST = ends now (not ended yet)
  assert.equal(classifyBooking(b, new Date('2030-06-10T05:00:01Z')).tab, 'completed'); // 1s later: expired
  // the same wall-clock in UTC terms would be wrong by 5.5h
  assert.equal(classifyBooking(b, new Date('2030-06-10T04:59:00Z')).tab, 'upcoming');
});

test('a slot ending at midnight (24:00) stays upcoming until IST midnight', () => {
  const b = slot('confirmed', '2030-06-10', '23:30:00', '24:00:00');
  assert.equal(slotEndMs(b), new Date('2030-06-10T18:30:00Z').getTime());
  assert.equal(classifyBooking(b, new Date('2030-06-10T18:29:00Z')).tab, 'upcoming');
  assert.equal(classifyBooking(b, new Date('2030-06-10T18:31:00Z')).tab, 'completed');
});

test('missing or malformed times never expire a booking by accident', () => {
  assert.equal(classifyBooking({ status: 'confirmed' }, NOW).tab, 'upcoming');
  assert.equal(classifyBooking({ status: 'confirmed', slot_date: '2030-06-01', slot_start: 'bad', slot_end: 'bad' }, NOW).tab, 'upcoming');
});

test('every booking lands in exactly one tab; tabs are sorted (upcoming soonest first, history newest first)', () => {
  const all = [
    slot('confirmed', '2030-06-12', '09:00:00', '09:30:00'),
    slot('pending', '2030-06-11', '09:00:00', '09:30:00'),
    slot('confirmed', '2030-06-10', '15:00:00', '15:30:00'),
    slot('arrived', '2030-06-09', '09:00:00', '09:30:00'),
    slot('arrived', '2030-06-08', '09:00:00', '09:30:00'),
    slot('cancelled', '2030-06-11', '09:00:00', '09:30:00'),
    slot('rejected', '2030-06-07', '09:00:00', '09:30:00'),
    slot('no_show', '2030-06-05', '09:00:00', '09:30:00'),
    slot('confirmed', '2030-06-01', '09:00:00', '09:30:00'),
  ];
  const up = bookingsForTab(all, 'upcoming', NOW);
  const done = bookingsForTab(all, 'completed', NOW);
  const cancelled = bookingsForTab(all, 'cancelled', NOW);
  assert.equal(up.length + done.length + cancelled.length, all.length);
  assert.deepEqual(up.map((b) => b.slot_date), ['2030-06-10', '2030-06-11', '2030-06-12']);
  assert.ok(up.every((b) => ['confirmed', 'pending'].includes(b.status)));
  assert.ok(done.every((b) => !['cancelled', 'rejected'].includes(b.status)));
  assert.deepEqual(done.map((b) => b.slot_date), ['2030-06-09', '2030-06-08', '2030-06-05', '2030-06-01']);
  assert.ok(cancelled.every((b) => ['cancelled', 'rejected'].includes(b.status)));
  assert.ok(!up.some((b) => b.status === 'arrived'));
});

test('refreshing the list after a status change moves the booking to the right tab', () => {
  const b = slot('confirmed', ...FUTURE);
  assert.equal(bookingsForTab([b], 'upcoming', NOW).length, 1);
  const checkedIn = { ...b, status: 'arrived' }; // operator scanned the QR
  assert.equal(bookingsForTab([checkedIn], 'upcoming', NOW).length, 0);
  assert.equal(bookingsForTab([checkedIn], 'completed', NOW).length, 1);
  const cancelled = { ...b, status: 'cancelled' };
  assert.equal(bookingsForTab([cancelled], 'upcoming', NOW).length, 0);
  assert.equal(bookingsForTab([cancelled], 'completed', NOW).length, 0);
  assert.equal(bookingsForTab([cancelled], 'cancelled', NOW).length, 1);
});

test('rating row: actionable only for an eligible visit; rated visits are not invited to rate again', () => {
  assert.equal(rateActionState(null), 'hidden');
  assert.equal(rateActionState({ eligible: false, rating: null }), 'hidden'); // not completed / own pump
  assert.equal(rateActionState({ eligible: true, rating: null }), 'rate');
  assert.equal(rateActionState({ eligible: true, rating: { editable: true } }), 'edit');
  assert.equal(rateActionState({ eligible: true, rating: { editable: false } }), 'rated'); // no duplicate invitation
  assert.equal(rateActionState(null, true), 'rate'); // completed visit but the check failed: never silently hidden
});
