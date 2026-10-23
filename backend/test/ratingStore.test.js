// Contract test for the Supabase rating store against a fake PostgREST client that enforces the rule
// that broke "Customer Feedback": pump_ratings has two FKs to users (user_id, hidden_by), so a bare
// users(...) embed is rejected with PGRST201.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSupabaseRatingStore } = require('../src/services/ratingStoreSupabase');
const { createRatingService } = require('../src/services/ratingService');

function fakeSupabase(tables) {
  const calls = [];
  function builder(table) {
    const q = { table, filters: {}, selectStr: null, rangeArgs: null };
    const api = {
      select(str) { q.selectStr = str; return api; },
      eq(k, v) { q.filters[k] = v; return api; },
      in(k, vals) { q.filters[k] = vals; return api; },
      order() { return api; },
      limit() { return api; },
      range(a, b) { q.rangeArgs = [a, b]; return api; },
      maybeSingle() { return Promise.resolve(run(true)); },
      then(res, rej) { return Promise.resolve(run(false)).then(res, rej); },
    };
    function run(single) {
      calls.push({ ...q });
      if (q.selectStr && /(^|[\s,(])users\(/.test(q.selectStr)) {
        return { data: null, error: { message: "Could not embed because more than one relationship was found for 'pump_ratings' and 'users'", code: 'PGRST201' } };
      }
      let rows = (tables[table] || []).filter((r) =>
        Object.entries(q.filters).every(([k, v]) => (Array.isArray(v) ? v.includes(r[k]) : r[k] === v)));
      if (table === 'pump_ratings' && /reviewer:users!pump_ratings_user_id_fkey/.test(q.selectStr || '')) {
        rows = rows.map((r) => ({ ...r, reviewer: { name: r._reviewer_name } }));
      }
      return { data: single ? rows[0] || null : rows, error: null };
    }
    return api;
  }
  return { from: builder, calls };
}

const tables = () => ({
  pumps: [
    { id: 'p1', owner_id: 'owner1', rating_avg: 4, rating_count: 1 },
    { id: 'p2', owner_id: 'owner2', rating_avg: null, rating_count: 0 },
  ],
  bookings: [{ id: 'b1', user_id: 'cust', pump_id: 'p1', status: 'arrived' }],
  pump_ratings: [
    { id: 'r1', pump_id: 'p1', user_id: 'cust', booking_id: 'b1', rating: 4, review: 'Good', tags: ['fast_service'], status: 'visible', edited_count: 0, created_at: '2030-06-10T10:00:00Z', _reviewer_name: 'Prathmesh Patil' },
  ],
  pump_rating_reports: [],
});

test('owner feedback loads a persisted review through the real store code (no ambiguous users embed)', async () => {
  const fake = fakeSupabase(tables());
  const svc = createRatingService({ store: createSupabaseRatingStore(fake) });
  const f = await svc.ownerFeedback({ ownerId: 'owner1', pumpId: 'p1' });
  assert.equal(f.count, 1);
  assert.equal(f.average, 4);
  assert.equal(f.reviews.length, 1);
  assert.equal(f.reviews[0].reviewer, 'Prathmesh'); // first name only
  assert.deepEqual(f.reviews[0].tags, ['fast_service']);
  assert.ok(!('user_id' in f.reviews[0]));
  const listCall = fake.calls.find((c) => c.table === 'pump_ratings' && c.selectStr.includes('reviewer'));
  assert.ok(/users!pump_ratings_user_id_fkey/.test(listCall.selectStr));
});

test('a bare users(name) embed would fail exactly like production did (guards the fake itself)', async () => {
  const fake = fakeSupabase(tables());
  const r = await fake.from('pump_ratings').select('id, users(name)');
  assert.equal(r.error.code, 'PGRST201');
});

test('public reviews use the same query and return the same aggregate as the owner view', async () => {
  const svc = createRatingService({ store: createSupabaseRatingStore(fakeSupabase(tables())) });
  const pub = await svc.pumpReviews({ pumpId: 'p1' });
  const own = await svc.ownerFeedback({ ownerId: 'owner1', pumpId: 'p1' });
  assert.equal(pub.average, own.average);
  assert.equal(pub.count, own.count);
  assert.equal(pub.reviews[0].id, own.reviews[0].id);
});

test("one owner cannot read another owner's feedback", async () => {
  const svc = createRatingService({ store: createSupabaseRatingStore(fakeSupabase(tables())) });
  await assert.rejects(svc.ownerFeedback({ ownerId: 'owner2', pumpId: 'p1' }), { code: 'NOT_YOUR_PUMP', status: 403 });
  await assert.rejects(svc.ownerFeedback({ ownerId: 'owner1', pumpId: 'p2' }), { code: 'NOT_YOUR_PUMP' });
  const empty = await svc.ownerFeedback({ ownerId: 'owner2', pumpId: 'p2' });
  assert.equal(empty.count, 0);
  assert.equal(empty.average, null); // genuinely empty is a valid answer, not an error
  assert.deepEqual(empty.reviews, []);
});

test('eligibility is computed without the new aggregate columns (works for completed bookings before/after migration)', async () => {
  const fake = fakeSupabase(tables());
  const svc = createRatingService({ store: createSupabaseRatingStore(fake) });
  const e = await svc.eligibility({ userId: 'cust', bookingId: 'b1' });
  assert.equal(e.eligible, true);
  assert.equal(e.rating.rating, 4);
  assert.ok(!fake.calls.some((c) => c.table === 'pumps' && /rating_avg/.test(c.selectStr || '')));
});
