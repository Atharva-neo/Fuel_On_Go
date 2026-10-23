// Pure geometry / gesture-coordination helpers for the nearby-pumps bottom
// sheet. Kept free of React Native imports so the logic can be unit tested.
//
// All positions are the sheet's *top edge* measured from the top of the
// container the sheet lives in (px). Smaller number = higher on screen.

export const SNAP_EXPANDED = 0;
export const SNAP_HALF = 1;
export const SNAP_PEEK = 2;
export const SNAP_COLLAPSED = 3;

export const COLLAPSED_VISIBLE = 68; // drag handle + title row stay visible
export const PEEK_VISIBLE = 260; // roughly two pump cards
const MIN_SNAP_GAP = 48;
const EPS = 0.5;

// Snap tops ordered from fully expanded to collapsed. Derived from the real
// measured container height and top safe-area inset, never from the window
// height, so the sheet is correct with/without a tab bar, notch or rotation.
export function computeSheetTops(containerH: number, topInset: number): number[] {
  const expanded = Math.round(topInset + 8);
  const collapsed = Math.max(expanded + MIN_SNAP_GAP * 3, Math.round(containerH - COLLAPSED_VISIBLE));
  const peek = Math.round(
    Math.min(Math.max(containerH - PEEK_VISIBLE, expanded + MIN_SNAP_GAP * 2), collapsed - MIN_SNAP_GAP)
  );
  const half = Math.round(
    Math.min(Math.max(containerH * 0.45, expanded + MIN_SNAP_GAP), peek - MIN_SNAP_GAP)
  );
  return [expanded, half, peek, collapsed];
}

export interface DragInput {
  /** sheet top when the drag was (re)based */
  startPos: number;
  /** finger translation at the moment the drag was (re)based */
  baseline: number;
  /** current finger translation since touch-down */
  translationY: number;
  /** current sheet top */
  pos: number;
  /** current vertical scroll offset of the pump list */
  listScrollY: number;
  expandedTop: number;
  collapsedTop: number;
}

export interface DragResult {
  /** who owns this gesture frame */
  owner: 'sheet' | 'list';
  /** new sheet top (unchanged when the list owns the gesture) */
  next: number;
  /** new drag base when it had to be re-based, otherwise the old one */
  startPos: number;
  baseline: number;
}

// Decides, for one gesture frame, whether the sheet moves or the list scrolls.
//  - Sheet fully open and list scrolled away from its top -> the list owns the
//    gesture (up or down); the sheet must not move.
//  - Otherwise the sheet follows the finger, clamped to its snap range. When
//    the list returns to its top while the finger keeps moving down, the sheet
//    starts following from exactly that point (no jump) because the drag base
//    is re-set while the list owns the gesture.
export function resolveDrag(input: DragInput): DragResult {
  const { startPos, baseline, translationY, pos, listScrollY, expandedTop, collapsedTop } = input;

  if (pos <= expandedTop + EPS && listScrollY > EPS) {
    return { owner: 'list', next: expandedTop, startPos: expandedTop, baseline: translationY };
  }

  const raw = startPos + (translationY - baseline);
  const next = Math.min(collapsedTop, Math.max(expandedTop, raw));
  return { owner: 'sheet', next, startPos, baseline };
}

// Picks the snap index to settle on when a drag is released: nearest snap to
// where the sheet would end up if it kept its release velocity for ~180ms.
export function pickSnapIndex(tops: number[], pos: number, velocityY: number): number {
  const projected = Math.min(tops[tops.length - 1], Math.max(tops[0], pos + velocityY * 0.18));
  let best = 0;
  let bestDist = Infinity;
  tops.forEach((t, i) => {
    const d = Math.abs(t - projected);
    if (d < bestDist) {
      best = i;
      bestDist = d;
    }
  });
  return best;
}

// True when a release should leave everything alone because the list (not the
// sheet) was the thing being dragged.
export function listOwnsRelease(pos: number, listScrollY: number, expandedTop: number): boolean {
  return pos <= expandedTop + EPS && listScrollY > EPS;
}

// Next snap when the header is tapped: step up one state; from fully
// expanded go back to the peek state so a tap always reverses an expansion.
export function nextSnapOnTap(current: number): number {
  return current === SNAP_EXPANDED ? SNAP_PEEK : current - 1;
}
