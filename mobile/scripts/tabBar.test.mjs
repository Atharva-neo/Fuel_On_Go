import test from 'node:test';
import assert from 'node:assert/strict';
import { tabBarMetrics } from '../src/navigation/tabBarMetrics.ts';

test('tab bar grows by the system inset (gesture bar, 3-button bar, none)', () => {
  assert.deepEqual(tabBarMetrics(0), { height: 64, paddingTop: 8, paddingBottom: 8 });
  const gesture = tabBarMetrics(16);
  const buttons = tabBarMetrics(48);
  assert.equal(gesture.height, 72);
  assert.equal(buttons.height, 104);
  assert.equal(buttons.paddingBottom, 48);
});
test('content area keeps the same height regardless of inset (no double counting)', () => {
  for (const inset of [0, 8, 24, 48, 64]) {
    const m = tabBarMetrics(inset);
    assert.equal(m.height - m.paddingBottom, 56);
  }
});
