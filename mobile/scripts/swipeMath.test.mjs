import test from 'node:test';
import assert from 'node:assert/strict';
import { isSwipe, targetIndex } from '../src/navigation/swipeMath.ts';

test('direction: finger left = next tab, right = previous', () => {
  assert.equal(targetIndex(1, 4, -80), 2);
  assert.equal(targetIndex(2, 4, 80), 1);
});
test('no wrapping at the first and last tab', () => {
  assert.equal(targetIndex(0, 3, 90), null);
  assert.equal(targetIndex(2, 3, -90), null);
});
test('vertical scrolls and tiny moves are not swipes', () => {
  assert.equal(isSwipe(10, 200, 0), false);
  assert.equal(isSwipe(70, 60, 0), false); // diagonal
  assert.equal(isSwipe(20, 2, 100), false);
});
test('long drags and quick flicks are swipes', () => {
  assert.equal(isSwipe(-80, 5, 0), true);
  assert.equal(isSwipe(30, 4, 900), true);
});
