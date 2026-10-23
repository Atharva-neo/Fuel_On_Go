// Decides what the map camera should do. Pure, so it can be tested without a map.
export interface CameraState {
  follow: boolean;
  centeredOnce: boolean;
}

export type CameraAction = 'none' | 'center-first' | 'follow';

export const initialCamera: CameraState = { follow: true, centeredOnce: false };

/** A device fix arrived. `browsingElsewhere` = user picked a manual area. */
export function onFix(s: CameraState, browsingElsewhere: boolean): { state: CameraState; action: CameraAction } {
  if (browsingElsewhere) return { state: s, action: 'none' }; // never drag them back from another area
  if (!s.centeredOnce) return { state: { ...s, centeredOnce: true }, action: 'center-first' };
  return { state: s, action: s.follow ? 'follow' : 'none' };
}

/** User panned / pinched the map. */
export function onUserGesture(s: CameraState): CameraState {
  return s.follow ? { ...s, follow: false } : s;
}

/** "My location" button or "Use my current location". */
export function onRecenter(s: CameraState): { state: CameraState; action: CameraAction } {
  return { state: { ...s, follow: true, centeredOnce: true }, action: 'center-first' };
}
