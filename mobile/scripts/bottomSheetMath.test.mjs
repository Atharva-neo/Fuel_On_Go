// Run: node scripts/bottomSheetMath.test.mjs   (Node >= 22.6 strips the TS types)
import assert from 'node:assert/strict';
import {
  SNAP_EXPANDED, SNAP_HALF, SNAP_PEEK, SNAP_COLLAPSED,
  computeSheetTops, resolveDrag, pickSnapIndex, listOwnsRelease, nextSnapOnTap,
} from '../src/utils/bottomSheetMath.ts';

let passed = 0;
const test = (name, fn) => { fn(); passed += 1; console.log('  ok  ' + name); };

// Simulates one drag: frames = [{ ty, scrollY }]; returns final sheet top and
// the per-frame results. Mirrors NearbyBottomSheet.onPanEvent exactly.
function drag(startPos, tops, frames, firstBaseline = 0) {
  let pos = startPos;
  let state = { startPos, baseline: firstBaseline };
  const log = [];
  for (const f of frames) {
    const r = resolveDrag({
      ...state, translationY: f.ty, pos, listScrollY: f.scrollY ?? 0,
      expandedTop: tops[0], collapsedTop: tops[3],
    });
    state = { startPos: r.startPos, baseline: r.baseline };
    if (r.owner === 'sheet') pos = r.next;
    log.push({ owner: r.owner, pos });
  }
  return { pos, log };
}

console.log('snap geometry');
test('snap tops are strictly ordered and inside the container for any phone size / inset', () => {
  for (const h of [320, 400, 480, 560, 640, 700, 760, 820, 900, 1000, 1200]) {
    for (const inset of [0, 24, 32, 44, 48]) {
      const t = computeSheetTops(h, inset);
      assert.equal(t.length, 4);
      for (let i = 1; i < 4; i++) assert.ok(t[i] > t[i - 1], `h=${h} inset=${inset} not ordered: ${t}`);
      assert.ok(t[0] >= inset, 'expanded sheet must not sit under the status bar');
      if (h >= 480) assert.ok(t[3] <= h - 60, `collapsed handle must stay on screen: h=${h} -> ${t}`);
    }
  }
});

console.log('drag / scroll ownership');
const T = computeSheetTops(700, 30); // [38, 315, 440, 632]
test('drag up from peek expands, and clamps at the top (cannot overshoot)', () => {
  const { pos } = drag(T[2], T, [{ ty: -50 }, { ty: -200 }, { ty: -400 }, { ty: -900 }]);
  assert.equal(pos, T[0]);
});
test('drag down from expanded with list at top collapses, clamped at the bottom', () => {
  const { pos } = drag(T[0], T, [{ ty: 40 }, { ty: 300 }, { ty: 900 }]);
  assert.equal(pos, T[3]);
});
test('list is never prevented from scrolling when sheet is open: sheet does not move while list is scrolled', () => {
  const { pos, log } = drag(T[0], T, [
    { ty: -20, scrollY: 10 }, { ty: -120, scrollY: 140 }, { ty: 60, scrollY: 60 }, { ty: 100, scrollY: 30 },
  ]);
  assert.equal(pos, T[0]);
  assert.ok(log.every((l) => l.owner === 'list'));
});
test('scrolling list back to top then continuing down collapses the sheet WITHOUT a jump', () => {
  // finger dragged down: list scrolls 300 -> 0 over frames, then sheet follows
  const frames = [
    { ty: 50, scrollY: 250 }, { ty: 150, scrollY: 100 }, { ty: 220, scrollY: 0 }, // list reaches top at ty=220
    { ty: 230, scrollY: 0 }, { ty: 260, scrollY: 0 }, { ty: 320, scrollY: 0 },
  ];
  const { log } = drag(T[0], T, frames);
  assert.ok(log.slice(0, 2).every((l) => l.owner === 'list'));
  // at ty=220 (list at top) base was reset at 150 -> sheet starts 70px in? it must start at the list-top frame
  assert.ok(log[2].pos - T[0] <= 70 + 1, 'first sheet frame may not jump more than the finger moved since list-owned frame');
  const first = log.find((l) => l.owner === 'sheet' && l.pos > T[0]);
  assert.ok(first && first.pos - T[0] <= 80, `jump on hand-over: ${first && first.pos - T[0]}px`);
  assert.equal(log[5].pos - log[4].pos, 60, 'after hand-over the sheet tracks the finger 1:1');
});
test('reversing direction mid-gesture follows the finger both ways', () => {
  const { log } = drag(T[2], T, [{ ty: -100 }, { ty: -200 }, { ty: -120 }, { ty: -20 }, { ty: 40 }]);
  assert.equal(log[0].pos, T[2] - 100);
  assert.equal(log[1].pos, T[2] - 200);
  assert.equal(log[2].pos, T[2] - 120);
  assert.equal(log[4].pos, T[2] + 40);
});
test('upward swipe starting at expanded + list at top: sheet stays, list scrolls (frames hand to list once scrollY>0)', () => {
  const { pos, log } = drag(T[0], T, [{ ty: -10, scrollY: 0 }, { ty: -60, scrollY: 40 }, { ty: -200, scrollY: 180 }]);
  assert.equal(pos, T[0]);
  assert.equal(log[2].owner, 'list');
});
test('random rapid gestures never leave the sheet outside its range or produce NaN', () => {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let pos = T[2];
  for (let g = 0; g < 400; g++) {
    const frames = Array.from({ length: 1 + Math.floor(rnd() * 12) }, () => ({
      ty: (rnd() - 0.5) * 1400, scrollY: rnd() < 0.3 ? rnd() * 400 : 0,
    }));
    ({ pos } = drag(pos, T, frames));
    assert.ok(Number.isFinite(pos) && pos >= T[0] && pos <= T[3], `pos=${pos}`);
    pos = T[pickSnapIndex(T, pos, (rnd() - 0.5) * 4000)];
  }
});

console.log('release / snapping');
test('slow release settles on the nearest snap', () => {
  assert.equal(pickSnapIndex(T, T[2] - 10, 0), SNAP_PEEK);
  assert.equal(pickSnapIndex(T, T[1] + 20, 0), SNAP_HALF);
  assert.equal(pickSnapIndex(T, T[0] + 15, 0), SNAP_EXPANDED);
  assert.equal(pickSnapIndex(T, T[3] - 10, 0), SNAP_COLLAPSED);
});
test('flick up / down is honoured (velocity in px/s)', () => {
  assert.ok(pickSnapIndex(T, T[2], -2500) < SNAP_PEEK);
  assert.ok(pickSnapIndex(T, T[0] + 100, 3000) > SNAP_EXPANDED);
  assert.equal(pickSnapIndex(T, T[2], 6000), SNAP_COLLAPSED);
  assert.equal(pickSnapIndex(T, T[2], -6000), SNAP_EXPANDED);
});
test('expanded sheet is never a dead end: from expanded a downward drag reaches every other state', () => {
  const reached = new Set();
  for (const dist of [0, 60, 180, 280, 400, 700]) {
    const { pos } = drag(T[0], T, [{ ty: dist }]);
    reached.add(pickSnapIndex(T, pos, 0));
  }
  assert.deepEqual([...reached].sort(), [0, 1, 2, 3]);
});
test('repeated expand/collapse cycles are stable and return to the same snap tops', () => {
  let pos = T[2];
  for (let i = 0; i < 50; i++) {
    ({ pos } = drag(pos, T, [{ ty: -300 }, { ty: -600 }])); pos = T[pickSnapIndex(T, pos, -1500)];
    assert.equal(pos, T[0]);
    ({ pos } = drag(pos, T, [{ ty: 200 }, { ty: 500 }])); pos = T[pickSnapIndex(T, pos, 1500)];
    assert.ok(pos > T[0]);
  }
});
test('release handled by the list (open + scrolled) leaves the sheet alone', () => {
  assert.equal(listOwnsRelease(T[0], 120, T[0]), true);
  assert.equal(listOwnsRelease(T[0], 0, T[0]), false);
  assert.equal(listOwnsRelease(T[2], 0, T[0]), false);
});
test('tapping the header always moves one step, and from expanded returns to peek', () => {
  assert.equal(nextSnapOnTap(SNAP_COLLAPSED), SNAP_PEEK);
  assert.equal(nextSnapOnTap(SNAP_PEEK), SNAP_HALF);
  assert.equal(nextSnapOnTap(SNAP_HALF), SNAP_EXPANDED);
  assert.equal(nextSnapOnTap(SNAP_EXPANDED), SNAP_PEEK);
});

console.log(`\n${passed} tests passed`);
