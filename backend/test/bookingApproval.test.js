const test = require('node:test');
const assert = require('node:assert/strict');
const { approvePending, isApprovalExpired, ApprovalError } = require('../src/services/bookingApproval');

// 2026-10-24 18:15 IST == 12:45 UTC
const booking = (over = {}) => ({ id: 'b1', status: 'pending', slot_date: '2026-10-24', slot_start: '18:15:00', ...over });
const at = (iso) => new Date(iso);

function fakeSupabase(rows) {
  return {
    from() {
      const st = { patch: null, eq: [] };
      const b = {
        update(p) { st.patch = p; return b; },
        eq(c, v) { st.eq.push([c, v]); return b; },
        select() { return b; },
        then(res, rej) {
          const hit = rows.filter((r) => st.eq.every(([c, v]) => r[c] === v));
          hit.forEach((r) => Object.assign(r, st.patch));
          return Promise.resolve({ data: hit.map((r) => ({ ...r })), error: null }).then(res, rej);
        },
      };
      return b;
    },
  };
}

test('several minutes before the start: approvable', async () => {
  const rows = [booking()];
  const out = await approvePending({ supabase: fakeSupabase(rows), booking: rows[0], now: at('2026-10-24T12:40:00Z') });
  assert.equal(out.status, 'confirmed');
});

test('one second before the start: still approvable', () => {
  assert.equal(isApprovalExpired(booking(), at('2026-10-24T12:44:59Z')), false);
});

test('exactly at the start and a few seconds after: 409 BOOKING_EXPIRED, row untouched', async () => {
  for (const now of ['2026-10-24T12:45:00Z', '2026-10-24T12:45:05Z']) {
    const rows = [booking()];
    await assert.rejects(
      approvePending({ supabase: fakeSupabase(rows), booking: rows[0], now: at(now) }),
      (e) => e instanceof ApprovalError && e.status === 409 && e.code === 'BOOKING_EXPIRED'
    );
    assert.equal(rows[0].status, 'pending');
  }
});

test('date and time both matter: a later date with an earlier clock time is not expired', () => {
  assert.equal(isApprovalExpired(booking({ slot_date: '2026-10-25', slot_start: '06:00:00' }), at('2026-10-24T12:45:00Z')), false);
  assert.equal(isApprovalExpired(booking({ slot_date: '2026-10-23', slot_start: '23:00:00' }), at('2026-10-24T00:00:00Z')), true);
});

test('IST not UTC: 18:15 IST is expired at 12:46 UTC but not at 12:44 UTC', () => {
  assert.equal(isApprovalExpired(booking(), at('2026-10-24T12:46:00Z')), true);
  assert.equal(isApprovalExpired(booking(), at('2026-10-24T12:44:00Z')), false);
});

test('approved / rejected / cancelled / arrived bookings are never moved', async () => {
  for (const status of ['confirmed', 'rejected', 'cancelled', 'arrived']) {
    const rows = [booking({ status })];
    await assert.rejects(
      approvePending({ supabase: fakeSupabase(rows), booking: rows[0], now: at('2026-10-24T12:00:00Z') }),
      (e) => e.code === 'NOT_PENDING' && e.status === 400
    );
    assert.equal(rows[0].status, status);
  }
});

test('simultaneous approvals: the status guard lets exactly one win', async () => {
  const rows = [booking()];
  const sb = fakeSupabase(rows);
  const stale = { ...rows[0] }; // both requests read "pending"
  const now = at('2026-10-24T12:00:00Z');
  const results = await Promise.allSettled([
    approvePending({ supabase: sb, booking: stale, now }),
    approvePending({ supabase: sb, booking: stale, now }),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(results.find((r) => r.status === 'rejected').reason.code, 'NOT_PENDING');
});

test('a booking rejected between read and write cannot be approved', async () => {
  const rows = [booking({ status: 'rejected' })];
  await assert.rejects(
    approvePending({ supabase: fakeSupabase(rows), booking: booking(), now: at('2026-10-24T12:00:00Z') }),
    (e) => e.code === 'NOT_PENDING'
  );
  assert.equal(rows[0].status, 'rejected');
});
