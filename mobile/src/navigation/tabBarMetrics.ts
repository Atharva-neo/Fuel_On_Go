// Bottom-tab geometry that sits ABOVE the Android system navigation (gesture pill or 3 buttons).
// The app is edge-to-edge, so the window extends under the system bar; the tab bar must add the
// bottom inset itself. A fixed `height: 64` (the old value) ignored it, which pushed the labels
// under the system buttons.
export const TAB_CONTENT_HEIGHT = 56;
export const TAB_PADDING_TOP = 8;
export const TAB_MIN_PADDING_BOTTOM = 8;

export function tabBarMetrics(bottomInset: number) {
  const paddingBottom = Math.max(bottomInset, TAB_MIN_PADDING_BOTTOM);
  return {
    height: TAB_CONTENT_HEIGHT + paddingBottom,
    paddingTop: TAB_PADDING_TOP,
    paddingBottom,
  };
}
