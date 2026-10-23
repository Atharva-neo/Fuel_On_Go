// Run: npm test   (node:test, no database needed)
// MemoryStore mirrors apply_trust_event() in supabase/migrations/007: per-user
// serialisation, idempotency key, one cancellation/no_show per booking,
// cancellation XOR no_show, single reversal, clamping, no_show_count.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTrustService, TrustError } = require('../src/services/trustScoreService');
const { buildPolicy, scoreBand, cancellationPenalty, defaultPolicy } = require('../src/config/trustPolicy');

class MemoryStore {
  constructor() {
    this.users = new Map();
    this.events = [];
    this.seq = 0;
    this.lock = Promise.resolve();
  }
  addUser(id, score = 80) { this.users.set(id, { trust_score: score, no_show_count: 0 }); }
  async getUser(id) { return this.users.get(id) || null; }
  async getEvent(id) { return this.events.find((e) => e.id === id) || null; }
  async listEvents(userId, limit) {
    return this.events.filter((e) => e.user_id === userId).slice().reverse().slice(0, limit);
  }
  // Serialised like `SELECT ... FOR UPDATE` on the user row.
  applyEvent(p) {
    const run = this.lock.then(() => this._apply(p));
    this.lock = run.catch(() => {});
    return run;
  }
  async _apply(p) {
    await Promise.resolve(); // yield, so unserialised code would interleave
    const user = this.users.get(p.userId);
    if (!user) throw new TrustError(404, 'USER_NOT_FOUND');
    const dup = this.events.find((e) => e.idempotency_key === p.idempotencyKey);
    if (dup) return { applied: false, duplicate: true, event: dup, score: user.trust_score };
    let delta = p.delta;
    let orig = null;
    let bookingId = p.bookingId;
    if (p.eventType === 'dispute_reversal') {
      orig = this.events.find((e) => e.id === p.reversalOf && e.user_id === p.userId);
      if (!orig) throw new TrustError(404, 'EVENT_NOT_FOUND');
      if (orig.event_type === 'dispute_reversal') throw new TrustError(400, 'CANNOT_REVERSE_A_REVERSAL');
      if (this.events.some((e) => e.reversal_of === orig.id)) throw new TrustError(409, 'ALREADY_REVERSED');
      delta = -orig.applied_delta;
      bookingId = orig.booking_id;
    } else if (bookingId) {
      if (this.events.some((e) => e.booking_id === bookingId && ['cancellation', 'no_show'].includes(e.event_type) && e.event_type !== p.eventType)) {
        throw new TrustError(409, 'BOOKING_ALREADY_RESOLVED');
      }
    }
    const before = user.trust_score;
    const after = Math.max(0, Math.min(100, before + delta));
    const event = {
      id: `ev${++this.seq}`, user_id: p.userId, booking_id: bookingId || null, event_type: p.eventType,
      requested_delta: delta, applied_delta: after - before, score_before: before, score_after: after,
      reason: p.reason, actor_id: p.actorId, idempotency_key: p.idempotencyKey,
      reversal_of: p.reversalOf || null, created_at: new Date().toISOString(),
    };
    this.events.push(event);
    user.trust_score = after;
    if (p.eventType === 'no_show') user.no_show_count += 1;
    if (orig && orig.event_type === 'no_show') user.no_show_count = Math.max(0, user.no_show_count - 1);
    return { applied: true, duplicate: false, event, score: after };
  }
}

// Slot start = 2030-06-10 12:00 IST.
const SLOT = { slot_date: '2030-06-10', slot_start: '12:00:00', slot_end: '12:30:00' };
const IST = (hhmm, date = '2030-06-10') => new Date(`${date}T${hhmm}:00+05:30`);
const hoursBefore = (h) => new Date(IST('12:00').getTime() - h * 3600000);

function setup({ score = 80, policy } = {}) {
  const store = new MemoryStore();
  store.addUser('u1', score);
  const svc = createTrustService({ store, policy });
  const booking = (id, extra = {}) => ({ id, user_id: 'u1', ...SLOT, status: 'confirmed', ...extra });
  return { store, svc, booking };
}

test('policy: default score is 80 and configurable via env', () => {
  assert.equal(defaultPolicy.defaultScore, 80);
  assert.equal(buildPolicy({ TRUST_DEFAULT_SCORE: '70', TRUST_NO_SHOW_PENALTY: '20', TRUST_NO_SHOW_GRACE_MINUTES: '5' }).defaultScore, 70);
  assert.equal(buildPolicy({ TRUST_NO_SHOW_PENALTY: '20' }).noShowPenalty, 20);
});

test('bands: 90/75/50/25/0 boundaries', () => {
  const t = [[100, 'Excellent'], [90, 'Excellent'], [89, 'Good'], [75, 'Good'], [74, 'Fair'], [50, 'Fair'],
    [49, 'Low'], [25, 'Low'], [24, 'Very Low'], [0, 'Very Low']];
  for (const [s, label] of t) assert.equal(scoreBand(s).label, label, `score ${s}`);
});

test('cancellation tiers by hours before slot (boundaries)', () => {
  const p = (h) => cancellationPenalty(h).penalty;
  assert.equal(p(48), 0);
  assert.equal(p(24.01), 0);
  assert.equal(p(24), 2);
  assert.equal(p(6), 2);
  assert.equal(p(5.99), 5);
  assert.equal(p(1), 5);
  assert.equal(p(0.99), 8);
  assert.equal(p(0), 8);
  assert.equal(p(-3), 8);
});

test('cancel > 24h before: no penalty, still audited', async () => {
  const { svc, booking, store } = setup();
  const r = await svc.recordUserCancellation({ booking: booking('b1'), previousStatus: 'confirmed', at: hoursBefore(30) });
  assert.equal(r.score, 80);
  assert.equal(store.events.length, 1);
  assert.equal(store.events[0].applied_delta, 0);
});

test('cancel 6-24h: -2, 1-6h: -5, <1h: -8', async () => {
  for (const [h, expected] of [[12, 78], [3, 75], [0.5, 72]]) {
    const { svc, booking } = setup();
    const r = await svc.recordUserCancellation({ booking: booking('b1'), previousStatus: 'confirmed', at: hoursBefore(h) });
    assert.equal(r.score, expected, `${h}h`);
  }
});

test('cancelling an unconfirmed (pending) booking costs nothing, even at the last minute', async () => {
  const { svc, booking } = setup();
  const r = await svc.recordUserCancellation({ booking: booking('b1', { status: 'pending' }), previousStatus: 'pending', at: hoursBefore(0.1) });
  assert.equal(r.score, 80);
});

test('cancellation is idempotent: repeating it never double-penalises', async () => {
  const { svc, booking, store } = setup();
  const b = booking('b1');
  await svc.recordUserCancellation({ booking: b, previousStatus: 'confirmed', at: hoursBefore(3) });
  const again = await svc.recordUserCancellation({ booking: b, previousStatus: 'confirmed', at: hoursBefore(0.2) });
  assert.equal(again.duplicate, true);
  assert.equal(store.users.get('u1').trust_score, 75);
  assert.equal(store.events.length, 1);
});

test('no-show: refused before the grace period ends, allowed after', async () => {
  const { svc, booking } = setup();
  const b = booking('b1');
  assert.equal(svc.noShowEligibility(b, IST('12:14')).code, 'GRACE_PERIOD');
  assert.equal(svc.noShowEligibility(b, IST('12:15')).ok, true);
  await assert.rejects(svc.recordVerifiedNoShow({ booking: b, operatorId: 'op', at: IST('12:10') }), { code: 'GRACE_PERIOD' });
});

test('verified no-show: -15, increments no_show_count, records the operator', async () => {
  const { svc, booking, store } = setup();
  const r = await svc.recordVerifiedNoShow({ booking: booking('b1'), operatorId: 'op1', at: IST('12:20') });
  assert.equal(r.score, 65);
  assert.equal(store.users.get('u1').no_show_count, 1);
  assert.equal(store.events[0].actor_id, 'op1');
});

test('no-show is idempotent and concurrent duplicates apply once', async () => {
  const { svc, booking, store } = setup();
  const b = booking('b1');
  const rs = await Promise.all(
    Array.from({ length: 5 }, () => svc.recordVerifiedNoShow({ booking: b, operatorId: 'op', at: IST('12:30') }))
  );
  assert.equal(rs.filter((r) => r.applied).length, 1);
  assert.equal(store.users.get('u1').trust_score, 65);
  assert.equal(store.users.get('u1').no_show_count, 1);
});

test('no no-show for bookings that were never confirmed, cancelled, rejected or already arrived', () => {
  const { svc, booking } = setup();
  for (const status of ['pending', 'rejected', 'cancelled', 'arrived']) {
    const r = svc.noShowEligibility(booking('b1', { status }), IST('13:00'));
    assert.equal(r.ok, false, status);
    assert.equal(r.code, 'NOT_CONFIRMED');
  }
});

test('a cancelled booking can never later receive a no-show penalty (and vice versa)', async () => {
  const { svc, booking, store } = setup();
  await svc.recordUserCancellation({ booking: booking('b1'), previousStatus: 'confirmed', at: hoursBefore(2) });
  await assert.rejects(svc.recordVerifiedNoShow({ booking: booking('b1'), operatorId: 'op', at: IST('13:00') }), { code: 'BOOKING_ALREADY_RESOLVED' });
  await svc.recordVerifiedNoShow({ booking: booking('b2'), operatorId: 'op', at: IST('13:00') });
  await assert.rejects(svc.recordUserCancellation({ booking: booking('b2'), previousStatus: 'confirmed', at: hoursBefore(0) }), { code: 'BOOKING_ALREADY_RESOLVED' });
  assert.equal(store.users.get('u1').trust_score, 80 - 5 - 15);
});

test('pump/system cancellations and rejections write no ledger entry and cost nothing', async () => {
  const { svc, store } = setup();
  // No service call exists for them by design: nothing to record.
  assert.equal(store.events.length, 0);
  assert.equal((await svc.getSummary('u1')).score, 80);
});

test('score is clamped to 0..100 and the ledger records what was really applied', async () => {
  const { svc, booking, store } = setup({ score: 10 });
  const r = await svc.recordVerifiedNoShow({ booking: booking('b1'), operatorId: 'op', at: IST('13:00') });
  assert.equal(r.score, 0);
  assert.equal(store.events[0].requested_delta, -15);
  assert.equal(store.events[0].applied_delta, -10);
});

test('admin reversal restores exactly the applied amount, once (clamped penalty)', async () => {
  const { svc, booking, store } = setup({ score: 10 });
  const r = await svc.recordVerifiedNoShow({ booking: booking('b1'), operatorId: 'op', at: IST('13:00') });
  const rev = await svc.reverseEvent({ eventId: r.event.id, adminId: 'adm', reason: 'Pump was closed' });
  assert.equal(rev.score, 10);
  assert.equal(store.users.get('u1').no_show_count, 0);
  const again = await svc.reverseEvent({ eventId: r.event.id, adminId: 'adm', reason: 'retry' });
  assert.equal(again.duplicate, true);
  assert.equal(store.users.get('u1').trust_score, 10);
  assert.equal(store.events.filter((e) => e.event_type === 'dispute_reversal').length, 1);
});

test('reversal needs a reason, a real event, and cannot reverse a reversal', async () => {
  const { svc, booking } = setup();
  const r = await svc.recordVerifiedNoShow({ booking: booking('b1'), operatorId: 'op', at: IST('13:00') });
  await assert.rejects(svc.reverseEvent({ eventId: r.event.id, adminId: 'a', reason: '  ' }), { code: 'REASON_REQUIRED' });
  await assert.rejects(svc.reverseEvent({ eventId: 'nope', adminId: 'a', reason: 'x' }), { code: 'EVENT_NOT_FOUND' });
  const rev = await svc.reverseEvent({ eventId: r.event.id, adminId: 'a', reason: 'x' });
  await assert.rejects(svc.reverseEvent({ eventId: rev.event.id, adminId: 'a', reason: 'x' }), { code: 'CANNOT_REVERSE_A_REVERSAL' });
});

test('concurrent reversals of the same event apply once', async () => {
  const { svc, booking, store } = setup();
  const r = await svc.recordVerifiedNoShow({ booking: booking('b1'), operatorId: 'op', at: IST('13:00') });
  const out = await Promise.allSettled(
    Array.from({ length: 4 }, (_, i) => svc.reverseEvent({ eventId: r.event.id, adminId: 'a', reason: `r${i}` }))
  );
  assert.equal(store.users.get('u1').trust_score, 80);
  assert.equal(store.events.filter((e) => e.event_type === 'dispute_reversal').length, 1);
  assert.ok(out.every((o) => o.status === 'fulfilled' || o.reason.code === 'ALREADY_REVERSED'));
});

test('summary returns score, label, recent events newest first with reversed flag', async () => {
  const { svc, booking } = setup();
  const r = await svc.recordVerifiedNoShow({ booking: booking('b1'), operatorId: 'op', at: IST('13:00') });
  await svc.recordUserCancellation({ booking: booking('b2'), previousStatus: 'confirmed', at: hoursBefore(12) });
  let s = await svc.getSummary('u1');
  assert.equal(s.score, 63);
  assert.equal(s.label, 'Fair');
  assert.equal(s.recent_events[0].event_type, 'cancellation');
  assert.equal(s.recent_events[1].reversed, false);
  await svc.reverseEvent({ eventId: r.event.id, adminId: 'a', reason: 'ok' });
  s = await svc.getSummary('u1');
  assert.equal(s.recent_events.find((e) => e.id === r.event.id).reversed, true);
  assert.equal(s.score, 78);
  assert.equal(s.label, 'Good');
});

test('summary for unknown user is a 404', async () => {
  const { svc } = setup();
  await assert.rejects(svc.getSummary('ghost'), { status: 404 });
});

test('existing users keep their score: nothing in the service rewrites scores outside events', async () => {
  const { store, svc } = setup({ score: 100 });
  assert.equal((await svc.getSummary('u1')).score, 100);
  assert.equal(store.events.length, 0);
});

test('configurable policy changes tiers, penalty and grace', async () => {
  const policy = buildPolicy({
    TRUST_NO_SHOW_PENALTY: '30',
    TRUST_NO_SHOW_GRACE_MINUTES: '5',
    TRUST_CANCELLATION_TIERS: JSON.stringify([{ minHours: 2, exclusive: false, penalty: 1 }, { minHours: null, penalty: 9 }]),
  });
  const { svc, booking } = setup({ policy });
  assert.equal(svc.noShowEligibility(booking('b1'), IST('12:05')).ok, true);
  const r = await svc.recordVerifiedNoShow({ booking: booking('b1'), operatorId: 'op', at: IST('12:10') });
  assert.equal(r.score, 50);
  assert.equal(svc.evaluateCancellation(booking('b2'), 'confirmed', hoursBefore(3)).delta, -1);
  assert.equal(svc.evaluateCancellation(booking('b2'), 'confirmed', hoursBefore(1)).delta, -9);
});
