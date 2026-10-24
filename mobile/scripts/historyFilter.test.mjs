import test from 'node:test';
import assert from 'node:assert/strict';
import { shiftDay, historyParams, describeRange, mergePage, STATUS_GROUPS } from '../src/utils/historyFilter.ts';

test('shiftDay is pure calendar math (the old Yesterday/Tomorrow bug)', () => {
  assert.equal(shiftDay('2026-10-24', -1), '2026-10-23');
  assert.equal(shiftDay('2026-10-22', 1), '2026-10-23');
  assert.equal(shiftDay('2026-03-01', -1), '2026-02-28');
  assert.equal(shiftDay('2026-12-31', 1), '2027-01-01');
});

test('All mode sends no date filter (complete history)', () => {
  assert.deepEqual(historyParams('all', '2026-10-24', 'all', '2026-10-24'), {});
});

test('week and day modes', () => {
  assert.deepEqual(historyParams('week', 'x', 'all', '2026-10-24'), { from: '2026-10-18', to: '2026-10-24' });
  assert.deepEqual(historyParams('day', '2026-10-23', 'all', '2026-10-24'), { date: '2026-10-23' });
});

test('status groups keep tabs separate and map to real statuses', () => {
  assert.equal(historyParams('all', 'x', 'completed', 't').status, 'arrived');
  assert.equal(historyParams('all', 'x', 'cancelled', 't').status, 'cancelled,rejected');
  assert.equal(historyParams('all', 'x', 'pending', 't').status, 'pending');
  const all = STATUS_GROUPS.flatMap((g) => g.statuses || []);
  assert.equal(new Set(all).size, all.length);
});

test('labels and page merging', () => {
  assert.equal(describeRange('day', '2026-10-23', '2026-10-24'), 'Yesterday (2026-10-23)');
  assert.equal(describeRange('all', 'x', 't'), 'All bookings');
  const merged = mergePage([{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'c' }]);
  assert.deepEqual(merged.map((m) => m.id), ['a', 'b', 'c']);
});
