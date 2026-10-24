// Pure swipe rules (kept free of react-native imports so they are unit-testable).
export const SWIPE_DISTANCE = 56; // px of horizontal travel that counts as a swipe
export const SWIPE_VELOCITY = 600; // px/s: a short fast flick also counts

/** Next tab for a swipe, or null at either end (no wrapping). dx < 0 = finger moved left = next tab. */
export function targetIndex(index: number, count: number, dx: number): number | null {
  const next = dx < 0 ? index + 1 : index - 1;
  return next >= 0 && next < count ? next : null;
}

/** Is this release a deliberate horizontal swipe (mostly horizontal, and far or fast enough)? */
export function isSwipe(dx: number, dy: number, vx: number): boolean {
  if (Math.abs(dx) < Math.abs(dy) * 1.5) return false;
  return Math.abs(dx) >= SWIPE_DISTANCE || Math.abs(vx) >= SWIPE_VELOCITY;
}
