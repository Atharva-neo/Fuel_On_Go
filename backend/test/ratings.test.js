// MemoryStore mirrors migration 008: booking row lock, UNIQUE(booking_id), status/ownership
// checks, 7-day edit window, aggregate recompute from VISIBLE ratings, reports + admin resolve.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createRatingService } = require('../src/services/ratingService');
const { RatingError, validateSubmission, cleanText, displayName, RATING_TAGS } = require('../src/services/ratingPolicy');

const BK = (n) => `bbbbbbbb-0000-0000-0000-${String(n).padStart(12, '0')}`;

class MemoryStore {
  constructor() {
    this.bookings = new Map();
    this.pumps = new Map();
    this.users = new Map();
    this.ratings = [];
    this.reports = [];
    this.seq = 0;
    this.clock = new Date('2030-06-10T10:00:00Z');
    this.lock = Promise.resolve();
  }
  now() { return this.clock; }
  addUser(id, name = 'Aarav Patil') { this.users.set(id, name); }
  addPump(id, ownerId) { this.pumps.set(id, { id, owner_id: ownerId, rating_avg: null, rating_count: 0 }); }
  addBooking(id, userId, pumpId, status) { this.bookings.set(id, { id, user_id: userId, pump_id: pumpId, status }); }
  recompute(pumpId) {
    const vis = this.ratings.filter((r) => r.pump_id === pumpId && r.status === 'visible');
    const p = this.pumps.get(pumpId);
    p.rating_count = vis.length;
    p.rating_avg = vis.length ? Math.round((vis.reduce((s, r) => s + r.rating, 0) / vis.length) * 100) / 100 : null;
  }
  submit(p) {
    const run = this.lock.then(() => this._submit(p));
    this.lock = run.catch(() => {});
    return run;
  }
  async _submit({ userId, bookingId, rating, review, tags }) {
    await Promise.resolve();
    const b = this.bookings.get(bookingId);
    if (!b) throw new RatingError(404, 'BOOKING_NOT_FOUND');
    if (b.user_id !== userId) throw new RatingError(403, 'NOT_YOUR_BOOKING');
    if (b.status !== 'arrived') throw new RatingError(409, 'NOT_COMPLETED');
    const pump = this.pumps.get(b.pump_id);
    if (pump.owner_id && pump.owner_id === userId) throw new RatingError(403, 'OWN_PUMP');
    const existing = this.ratings.find((r) => r.booking_id === bookingId);
    let row, created = false, duplicate = false;
    if (existing) {
      const same = existing.rating === rating && (existing.review || '') === (review || '') && JSON.stringify(existing.tags) === JSON.stringify(tags);
      if (same) { duplicate = true; row = existing; }
      else {
        if (this.clock - new Date(existing.created_at) > 7 * 86400000) throw new RatingError(409, 'EDIT_WINDOW_CLOSED');
        Object.assign(existing, { rating, review, tags, edited_count: existing.edited_count + 1, updated_at: this.clock.toISOString() });
        row = existing;
      }
    } else {
      row = { id: `r${++this.seq}`, pump_id: b.pump_id, user_id: userId, booking_id: bookingId, rating, review, tags, status: 'visible', edited_count: 0, created_at: this.clock.toISOString(), updated_at: this.clock.toISOString() };
      this.ratings.push(row);
      created = true;
    }
    this.recompute(b.pump_id);
    return { rating: row, created, duplicate, pump: { id: pump.id, rating_avg: pump.rating_avg, rating_count: pump.rating_count } };
  }
  async getBooking(id) { return this.bookings.get(id) || null; }
  async getPump(id) { return this.pumps.get(id) || null; }
  async getRatingByBooking(id) { return this.ratings.find((r) => r.booking_id === id) || null; }
  async listRatings(pumpId, { limit, offset, includeHidden }) {
    return this.ratings
      .filter((r) => r.pump_id === pumpId && (includeHidden || r.status === 'visible'))
      .slice().reverse().slice(offset, offset + limit)
      .map((r) => ({ ...r, user_name: this.users.get(r.user_id), report_status: (this.reports.find((x) => x.rating_id === r.id) || {}).status || null }));
  }
  async listRecent(pumpId, n) { return this.ratings.filter((r) => r.pump_id === pumpId && r.status === 'visible').slice().reverse().slice(0, n); }
  async report({ ownerId, ratingId, reason }) {
    const r = this.ratings.find((x) => x.id === ratingId);
    if (!r) throw new RatingError(404, 'RATING_NOT_FOUND');
    if (this.pumps.get(r.pump_id).owner_id !== ownerId) throw new RatingError(403, 'NOT_YOUR_PUMP');
    const ex = this.reports.find((x) => x.rating_id === ratingId && x.reporter_id === ownerId);
    if (ex) return { report: ex, duplicate: true };
    const rep = { id: `rep${++this.seq}`, rating_id: ratingId, reporter_id: ownerId, reason, status: 'open' };
    this.reports.push(rep);
    return { report: rep, duplicate: false };
  }
  async resolve({ adminId, reportId, action, note }) {
    const rep = this.reports.find((x) => x.id === reportId);
    if (!rep) throw new RatingError(404, 'REPORT_NOT_FOUND');
    if (rep.status !== 'open') throw new RatingError(409, 'ALREADY_RESOLVED');
    Object.assign(rep, { status: action === 'uphold' ? 'upheld' : 'dismissed', resolved_by: adminId, resolution_note: note });
    if (action === 'uphold') {
      const r = this.ratings.find((x) => x.id === rep.rating_id);
      Object.assign(r, { status: 'hidden', hidden_by: adminId });
      this.recompute(r.pump_id);
    }
    return { report_id: reportId, action };
  }
}

function setup() {
  const store = new MemoryStore();
  store.addUser('cust', 'Aarav Patil');
  store.addUser('cust2', 'Sneha Kulkarni');
  store.addUser('owner', 'Owner One');
  store.addUser('owner2', 'Owner Two');
  store.addPump('p1', 'owner');
  store.addPump('p2', 'owner2');
  store.addBooking(BK(1), 'cust', 'p1', 'arrived');
  store.addBooking(BK(2), 'cust', 'p1', 'confirmed');
  store.addBooking(BK(3), 'cust2', 'p1', 'arrived');
  store.addBooking(BK(4), 'cust', 'p2', 'pending');
  store.addBooking(BK(5), 'owner', 'p1', 'arrived'); // owner "visiting" their own pump
  const svc = createRatingService({ store, now: () => store.now() });
  return { store, svc };
}

test('rating a legitimately completed visit stores it against the booking’s pump and returns the aggregate', async () => {
  const { svc, store } = setup();
  const r = await svc.submit({ userId: 'cust', body: { booking_id: BK(1), rating: 4, review: 'Quick and clean', tags: ['fast_service', 'clean_facility'] } });
  assert.equal(r.created, true);
  assert.equal(r.pump.id, 'p1');
  assert.deepEqual(r.summary, { average: 4, count: 1 });
  assert.equal(store.ratings[0].pump_id, 'p1');
  assert.equal(store.ratings[0].booking_id, BK(1));
  assert.deepEqual(store.ratings[0].tags, ['clean_facility', 'fast_service']);
});

test('the pump comes from the booking: a client-supplied pump_id is ignored', async () => {
  const { svc, store } = setup();
  const r = await svc.submit({ userId: 'cust', body: { booking_id: BK(1), pump_id: 'p2', rating: 5 } });
  assert.equal(r.pump.id, 'p1');
  assert.equal(store.pumps.get('p2').rating_count, 0);
});

test('incomplete or ineligible bookings are rejected (confirmed, pending)', async () => {
  const { svc } = setup();
  await assert.rejects(svc.submit({ userId: 'cust', body: { booking_id: BK(2), rating: 5 } }), { code: 'NOT_COMPLETED', status: 409 });
  await assert.rejects(svc.submit({ userId: 'cust', body: { booking_id: BK(4), rating: 5 } }), { code: 'NOT_COMPLETED' });
});

test('invalid star values and malformed input are rejected before touching the store', async () => {
  const { svc, store } = setup();
  for (const rating of [0, 6, -1, 3.5, '4', null, undefined, NaN, Infinity, [], {}]) {
    await assert.rejects(svc.submit({ userId: 'cust', body: { booking_id: BK(1), rating } }), { code: 'INVALID_RATING' }, String(rating));
  }
  await assert.rejects(svc.submit({ userId: 'cust', body: { rating: 5 } }), { code: 'BOOKING_REQUIRED' });
  await assert.rejects(svc.submit({ userId: 'cust', body: { booking_id: BK(1), rating: 5, tags: ['nope'] } }), { code: 'INVALID_TAGS' });
  await assert.rejects(svc.submit({ userId: 'cust', body: { booking_id: BK(1), rating: 5, tags: 'fast_service' } }), { code: 'INVALID_TAGS' });
  await assert.rejects(svc.submit({ userId: 'cust', body: { booking_id: BK(1), rating: 5, review: 'x'.repeat(1001) } }), { code: 'REVIEW_TOO_LONG' });
  await assert.rejects(svc.submit({ userId: 'cust', body: { booking_id: BK(1), rating: 5, review: 42 } }), { code: 'INVALID_REVIEW' });
  assert.equal(store.ratings.length, 0);
});

test('duplicate submissions (repeated taps, retries, concurrent requests) produce exactly one rating', async () => {
  const { svc, store } = setup();
  const body = { booking_id: BK(1), rating: 5, review: 'Great' };
  const results = await Promise.all(Array.from({ length: 6 }, () => svc.submit({ userId: 'cust', body })));
  assert.equal(store.ratings.length, 1);
  assert.equal(results.filter((r) => r.created).length, 1);
  assert.equal(results.filter((r) => r.duplicate).length, 5);
  assert.equal(store.pumps.get('p1').rating_count, 1);
});

test('customers cannot rate another customer’s booking', async () => {
  const { svc, store } = setup();
  await assert.rejects(svc.submit({ userId: 'cust2', body: { booking_id: BK(1), rating: 1 } }), { code: 'NOT_YOUR_BOOKING', status: 403 });
  await assert.rejects(svc.submit({ userId: 'cust', body: { booking_id: BK(99), rating: 1 } }), { code: 'BOOKING_NOT_FOUND' });
  assert.equal(store.ratings.length, 0);
});

test('owners cannot rate their own pump through the customer flow', async () => {
  const { svc } = setup();
  await assert.rejects(svc.submit({ userId: 'owner', body: { booking_id: BK(5), rating: 5 } }), { code: 'OWN_PUMP', status: 403 });
  const e = await svc.eligibility({ userId: 'owner', bookingId: BK(5) });
  assert.equal(e.eligible, false);
  assert.equal(e.reason, 'OWN_PUMP');
});

test('an eligible customer can edit within the window (same row, count unchanged); after it, edits are refused', async () => {
  const { svc, store } = setup();
  await svc.submit({ userId: 'cust', body: { booking_id: BK(1), rating: 2 } });
  const edit = await svc.submit({ userId: 'cust', body: { booking_id: BK(1), rating: 5, review: 'Changed my mind' } });
  assert.equal(edit.created, false);
  assert.equal(store.ratings.length, 1);
  assert.equal(store.ratings[0].edited_count, 1);
  assert.deepEqual(edit.summary, { average: 5, count: 1 });
  store.clock = new Date('2030-06-20T10:00:00Z'); // 10 days later
  await assert.rejects(svc.submit({ userId: 'cust', body: { booking_id: BK(1), rating: 1 } }), { code: 'EDIT_WINDOW_CLOSED' });
});

test('aggregates are recomputed from stored ratings: average and count are real, no-review pumps have none', async () => {
  const { svc, store } = setup();
  assert.deepEqual((await svc.pumpReviews({ pumpId: 'p1' })).average, null);
  assert.equal((await svc.pumpReviews({ pumpId: 'p1' })).count, 0);
  await svc.submit({ userId: 'cust', body: { booking_id: BK(1), rating: 5 } });
  const r = await svc.submit({ userId: 'cust2', body: { booking_id: BK(3), rating: 2 } });
  assert.deepEqual(r.summary, { average: 3.5, count: 2 });
  const view = await svc.pumpReviews({ pumpId: 'p1' });
  assert.equal(view.average, 3.5);
  assert.deepEqual(view.distribution, { 1: 0, 2: 1, 3: 0, 4: 0, 5: 1 });
  assert.equal(store.pumps.get('p2').rating_avg, null); // other pump untouched
});

test('public reviews expose a first name only: no phone, vehicle or full name', async () => {
  const { svc } = setup();
  await svc.submit({ userId: 'cust', body: { booking_id: BK(1), rating: 4, review: 'ok' } });
  const view = await svc.pumpReviews({ pumpId: 'p1' });
  assert.equal(view.reviews[0].reviewer, 'Aarav');
  assert.ok(!('user_id' in view.reviews[0]) && !('phone' in view.reviews[0]));
  assert.equal(view.reviews[0].verified_visit, true);
  assert.equal(displayName(''), 'Customer');
});

test('eligibility endpoint data: completed + unrated, rated, not completed', async () => {
  const { svc } = setup();
  assert.deepEqual(await svc.eligibility({ userId: 'cust', bookingId: BK(1) }), { eligible: true, reason: null, pump_id: 'p1', rating: null });
  assert.equal((await svc.eligibility({ userId: 'cust', bookingId: BK(2) })).reason, 'NOT_COMPLETED');
  await svc.submit({ userId: 'cust', body: { booking_id: BK(1), rating: 3, review: 'meh' } });
  const e = await svc.eligibility({ userId: 'cust', bookingId: BK(1) });
  assert.equal(e.rating.rating, 3);
  assert.equal(e.rating.editable, true);
  await assert.rejects(svc.eligibility({ userId: 'cust2', bookingId: BK(1) }), { code: 'BOOKING_NOT_FOUND' }); // not leaked to others
});

test('owners can only view feedback for their own pumps', async () => {
  const { svc } = setup();
  await svc.submit({ userId: 'cust', body: { booking_id: BK(1), rating: 4 } });
  const mine = await svc.ownerFeedback({ ownerId: 'owner', pumpId: 'p1' });
  assert.equal(mine.count, 1);
  assert.equal(mine.reviews.length, 1);
  await assert.rejects(svc.ownerFeedback({ ownerId: 'owner2', pumpId: 'p1' }), { code: 'NOT_YOUR_PUMP', status: 403 });
  await assert.rejects(svc.ownerFeedback({ ownerId: 'owner', pumpId: 'nope' }), { code: 'PUMP_NOT_FOUND' });
});

test('owner view includes distribution and an 8-week trend', async () => {
  const { svc } = setup();
  await svc.submit({ userId: 'cust', body: { booking_id: BK(1), rating: 4 } });
  const f = await svc.ownerFeedback({ ownerId: 'owner', pumpId: 'p1' });
  assert.equal(f.trend.length, 8);
  assert.equal(f.trend.at(-1).count, 1);
  assert.equal(f.trend.at(-1).average, 4);
  assert.equal(f.distribution[4], 1);
});

test('owners cannot edit or delete reviews; they can only report them (idempotently), with an audit trail', async () => {
  const { svc, store } = setup();
  const created = await svc.submit({ userId: 'cust', body: { booking_id: BK(1), rating: 1, review: 'Terrible' } });
  const id = store.ratings[0].id;
  assert.equal(typeof svc.deleteRating, 'undefined');
  assert.equal(typeof svc.updateRating, 'undefined');
  await assert.rejects(svc.report({ ownerId: 'owner', ratingId: id, reason: 'x' }), { code: 'REASON_REQUIRED' });
  await assert.rejects(svc.report({ ownerId: 'owner2', ratingId: id, reason: 'Not a real customer' }), { code: 'NOT_YOUR_PUMP' });
  const a = await svc.report({ ownerId: 'owner', ratingId: id, reason: 'Abusive language in the review' });
  const b = await svc.report({ ownerId: 'owner', ratingId: id, reason: 'Abusive language in the review' });
  assert.equal(a.duplicate, false);
  assert.equal(b.duplicate, true);
  assert.equal(store.reports.length, 1);
  assert.equal(store.ratings[0].status, 'visible'); // reporting alone never changes the rating
  assert.equal(created.summary.average, 1);
});

test('admin resolution is explicit and audited: uphold hides the review and updates the average; dismiss keeps it', async () => {
  const { svc, store } = setup();
  await svc.submit({ userId: 'cust', body: { booking_id: BK(1), rating: 1, review: 'Abusive' } });
  await svc.submit({ userId: 'cust2', body: { booking_id: BK(3), rating: 5 } });
  const bad = store.ratings[0].id;
  const { report } = await svc.report({ ownerId: 'owner', ratingId: bad, reason: 'Contains abuse and threats' });
  await assert.rejects(svc.resolveReport({ adminId: 'adm', reportId: report.id, action: 'uphold', note: '' }), { code: 'NOTE_REQUIRED' });
  await assert.rejects(svc.resolveReport({ adminId: 'adm', reportId: report.id, action: 'delete', note: 'x' }), { code: 'BAD_ACTION' });
  assert.equal(store.pumps.get('p1').rating_avg, 3); // before: (1+5)/2
  await svc.resolveReport({ adminId: 'adm', reportId: report.id, action: 'uphold', note: 'Violates review policy' });
  assert.equal(store.pumps.get('p1').rating_avg, 5);
  assert.equal(store.pumps.get('p1').rating_count, 1);
  assert.equal(store.reports[0].resolved_by, 'adm');
  assert.equal(store.reports[0].resolution_note, 'Violates review policy');
  await assert.rejects(svc.resolveReport({ adminId: 'adm', reportId: report.id, action: 'dismiss', note: 'again' }), { code: 'ALREADY_RESOLVED' });
  const pub = await svc.pumpReviews({ pumpId: 'p1' });
  assert.equal(pub.reviews.length, 1); // hidden review not public
  const own = await svc.ownerFeedback({ ownerId: 'owner', pumpId: 'p1' });
  assert.equal(own.reviews.length, 2); // owner still sees it, marked hidden
  assert.equal(own.reviews.find((r) => r.status === 'hidden').report_status, 'upheld');
});

test('ratings are independent of the Trust Score: the rating service never touches trust state', async () => {
  const { svc, store } = setup();
  store.trustTouched = false;
  const guarded = new Proxy(store, { get(t, k) { if (/trust/i.test(String(k))) t.trustTouched = true; return t[k]; } });
  const s2 = createRatingService({ store: guarded, now: () => store.now() });
  await s2.submit({ userId: 'cust', body: { booking_id: BK(1), rating: 1 } });
  assert.equal(store.trustTouched, false);
  // and the code paths do not reference trust at all
  const fs = require('node:fs');
  for (const f of ['ratingService.js', 'ratingPolicy.js', 'ratingStoreSupabase.js']) {
    assert.ok(!/trust/i.test(fs.readFileSync(require('node:path').join(__dirname, '../src/services', f), 'utf8')), f);
  }
});

test('input cleaning: control characters stripped, whitespace collapsed, empty becomes null, tags de-duplicated', () => {
  assert.equal(cleanText('  hi\u0000 ​there\t\t ok  ', 100), 'hi there ok');
  assert.equal(cleanText('   ', 100), null);
  const v = validateSubmission({ booking_id: BK(1), rating: 3, review: '', tags: ['fast_service', 'fast_service'] });
  assert.equal(v.review, null);
  assert.deepEqual(v.tags, ['fast_service']);
  assert.ok(RATING_TAGS.includes('long_wait') && RATING_TAGS.includes('poor_service'));
});

test('the exact payload the app sends is accepted (4 stars, review, tags, booking id); the pump is derived server-side', async () => {
  const { svc, store } = setup();
  const payload = { booking_id: BK(1), rating: 4, review: 'Helpful staff, very nice', tags: ['fast_service', 'short_wait', 'helpful_staff'] };
  assert.equal(validateSubmission(payload).rating, 4);
  const r = await svc.submit({ userId: 'cust', body: payload });
  assert.equal(r.pump.id, 'p1');
  assert.deepEqual(store.ratings[0].tags, ['fast_service', 'helpful_staff', 'short_wait']);
});

test('a request without stars or booking id says exactly which field is missing', async () => {
  const { svc } = setup();
  await assert.rejects(svc.submit({ userId: 'cust', body: { booking_id: BK(1), review: 'x' } }), { code: 'INVALID_RATING', status: 400 });
  await assert.rejects(svc.submit({ userId: 'cust', body: { rating: 4 } }), { code: 'BOOKING_REQUIRED', status: 400 });
  await assert.rejects(svc.submit({ userId: 'cust', body: { pump_id: 'p1', rating: 4 } }), { code: 'BOOKING_REQUIRED' }); // a pump id alone is never proof of a visit
});
