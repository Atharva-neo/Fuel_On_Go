import test from 'node:test';
import assert from 'node:assert/strict';
import { approvalExpired } from '../src/utils/approvalExpiry.ts';

const b = { slot_date: '2026-10-24', slot_start: '18:15:00' }; // 12:45 UTC
const ms = (iso) => new Date(iso).getTime();

test('future, boundary and past', () => {
  assert.equal(approvalExpired(b, ms('2026-10-24T12:40:00Z')), false);
  assert.equal(approvalExpired(b, ms('2026-10-24T12:44:59Z')), false);
  assert.equal(approvalExpired(b, ms('2026-10-24T12:45:00Z')), true);
  assert.equal(approvalExpired(b, ms('2026-10-24T12:45:05Z')), true);
});

test('a different date matters, and HH:MM works', () => {
  assert.equal(approvalExpired({ slot_date: '2026-10-25', slot_start: '06:00' }, ms('2026-10-24T12:45:00Z')), false);
  assert.equal(approvalExpired({ slot_date: '2026-10-23', slot_start: '23:00' }, ms('2026-10-24T00:00:00Z')), true);
});

test('missing time never marks a booking expired', () => {
  assert.equal(approvalExpired({}, Date.now()), false);
});
