// Selected-location state for "Register Pump". One structure shared by the
// address-search flow, the one-time GPS flow and manual pin placement.
// Pure functions only, so every rule is unit-testable.
import { isValidCoord } from './geo.ts';
import type { LocationProvider, RawFix } from './controller.ts';

export type SelectionSource = 'search' | 'gps' | 'manual';

export interface PumpLocationState {
  point: { lat: number; lng: number } | null;
  address: string | null;
  addressStatus: 'idle' | 'loading' | 'ready' | 'failed';
  source: SelectionSource | null;
  /** Reported GPS error radius in metres (only for source 'gps'). */
  accuracyM: number | null;
  gpsTimestamp: number | null;
  /** Bumped on every point change; async results carry the seq they were started for. */
  seq: number;
}

export const emptyPumpLocation: PumpLocationState = {
  point: null,
  address: null,
  addressStatus: 'idle',
  source: null,
  accuracyM: null,
  gpsTimestamp: null,
  seq: 0,
};

export interface SearchHit {
  lat: number;
  lng: number;
  label: string;
  /** [south, north, west, east] as strings, straight from Nominatim. */
  bbox?: [string, string, string, string] | null;
  details?: { city: string; district: string; postcode: string };
}

function next(s: PumpLocationState, patch: Partial<PumpLocationState>): PumpLocationState {
  return { ...s, ...patch, seq: s.seq + 1 };
}

export function selectSearchResult(s: PumpLocationState, hit: SearchHit): PumpLocationState {
  if (!isValidCoord(hit.lat, hit.lng)) return s;
  return next(s, {
    point: { lat: Number(hit.lat), lng: Number(hit.lng) },
    address: hit.label || null,
    addressStatus: hit.label ? 'ready' : 'loading',
    source: 'search',
    accuracyM: null,
    gpsTimestamp: null,
  });
}

export function applyGpsFix(s: PumpLocationState, fix: RawFix): PumpLocationState {
  if (!isValidCoord(fix.lat, fix.lng)) return s;
  return next(s, {
    point: { lat: fix.lat, lng: fix.lng },
    address: null,
    addressStatus: 'loading',
    source: 'gps',
    accuracyM: fix.accuracy,
    gpsTimestamp: fix.timestamp,
  });
}

/** The owner dragged/panned the map and it settled on (lat, lng). */
export function applyManualPoint(s: PumpLocationState, lat: number, lng: number): PumpLocationState {
  if (!isValidCoord(lat, lng)) return s;
  if (s.point && s.point.lat === lat && s.point.lng === lng) return s;
  return next(s, {
    point: { lat, lng },
    address: null, // the old address described a different spot
    addressStatus: 'loading',
    source: 'manual',
    accuracyM: null,
    gpsTimestamp: null,
  });
}

/** Reverse-geocode answered. Ignored if the point moved on since it was requested. */
export function applyAddress(s: PumpLocationState, seq: number, address: string): PumpLocationState {
  if (seq !== s.seq) return s;
  return { ...s, address, addressStatus: 'ready' };
}

export function applyAddressFailure(s: PumpLocationState, seq: number): PumpLocationState {
  if (seq !== s.seq) return s;
  return { ...s, addressStatus: 'failed' };
}

export function canConfirm(s: PumpLocationState): boolean {
  return !!s.point && isValidCoord(s.point.lat, s.point.lng);
}

// ─── one-time GPS acquisition (no watch, no background) ───
export type OneShotResult =
  | { ok: true; fix: RawFix; approximate: boolean; reason?: 'low_accuracy' | 'stale' }
  | { ok: false; reason: 'permission_denied' | 'permission_blocked' | 'services_disabled' | 'timeout' | 'unavailable' };

export const GPS_GOOD_ACCURACY_M = 50;
export const GPS_MAX_AGE_MS = 30_000;

export async function acquireOnce(
  provider: LocationProvider,
  opts: { timeoutMs?: number; now?: () => number } = {}
): Promise<OneShotResult> {
  const now = opts.now ?? Date.now;
  try {
    let { status } = await provider.getPermission();
    if (status === 'undetermined') status = (await provider.requestPermission()).status;
    if (status === 'blocked') return { ok: false, reason: 'permission_blocked' };
    if (status !== 'granted') return { ok: false, reason: 'permission_denied' };
    if (!(await provider.servicesEnabled())) return { ok: false, reason: 'services_disabled' };

    const fix = await provider.getCurrent(opts.timeoutMs ?? 20_000, true);
    if (!isValidCoord(fix.lat, fix.lng)) return { ok: false, reason: 'unavailable' };
    const stale = now() - fix.timestamp > GPS_MAX_AGE_MS;
    const lowAcc = fix.accuracy == null || fix.accuracy > GPS_GOOD_ACCURACY_M;
    return {
      ok: true,
      fix,
      approximate: stale || lowAcc,
      reason: stale ? 'stale' : lowAcc ? 'low_accuracy' : undefined,
    };
  } catch (e: any) {
    return { ok: false, reason: e?.code === 'TIMEOUT' ? 'timeout' : 'unavailable' };
  }
}

export function gpsProblemMessage(reason: Extract<OneShotResult, { ok: false }>['reason'], tr?: (key: string) => string): string {
  if (tr) return tr(`picker.gps.${['permission_denied', 'permission_blocked', 'services_disabled', 'timeout'].includes(reason) ? reason : 'other'}`);
  switch (reason) {
    case 'permission_denied':
      return 'Location permission was denied. You can still search for the address or place the pin on the map.';
    case 'permission_blocked':
      return 'Location is blocked for this app. Enable it in system settings, or search for the address instead.';
    case 'services_disabled':
      return 'Device location (GPS) is turned off. Turn it on and retry, or search for the address.';
    case 'timeout':
      return 'Could not get a GPS fix in time. Retry, move to an open area, or search for the address.';
    default:
      return "Couldn't read your location. Retry, or search for the address.";
  }
}

// ─── search helpers ───
/** Only the most recent call's result is returned; older ones resolve to `superseded`. */
export function latestOnly<T>() {
  let n = 0;
  return async (work: () => Promise<T>): Promise<{ superseded: true } | { superseded: false; value: T }> => {
    const mine = ++n;
    const value = await work();
    return mine === n ? { superseded: false, value } : { superseded: true };
  };
}

/** Zoom to use for a result: bbox-derived when meaningful, street level otherwise. */
export function bboxSpanDeg(bbox?: [string, string, string, string] | null): number | null {
  if (!bbox) return null;
  const [s, n, w, e] = bbox.map(Number);
  if (![s, n, w, e].every(Number.isFinite)) return null;
  return Math.max(Math.abs(n - s), Math.abs(e - w));
}

export function parseSearchHits(data: any): SearchHit[] {
  return (Array.isArray(data) ? data : [])
    .map((item: any) => ({
      lat: Number(item.lat),
      lng: Number(item.lon),
      label: String(item.display_name || ''),
      bbox: Array.isArray(item.boundingbox) && item.boundingbox.length === 4 ? (item.boundingbox as [string, string, string, string]) : null,
      details: {
        city: String(item.address?.city || item.address?.town || item.address?.village || item.address?.suburb || item.address?.county || ''),
        district: String(item.address?.state_district || item.address?.county || ''),
        postcode: String(item.address?.postcode || ''),
      },
    }))
    .filter((h) => isValidCoord(h.lat, h.lng) && h.label);
}

export function formatCoord(n: number): string {
  return n.toFixed(6); // display only; the stored value keeps full precision
}

/**
 * The two location actions sit side by side only when each button can show its
 * full label ("Set My Current Location" needs ~230 px). On phones they stack,
 * so labels never wrap, clip or collide.
 */
export const ACTION_MIN_WIDTH = 230;
export function shouldStackLocationActions(containerWidth: number, sidePadding = 16, gap = 10): boolean {
  return containerWidth - sidePadding * 2 - gap < ACTION_MIN_WIDTH * 2;
}
