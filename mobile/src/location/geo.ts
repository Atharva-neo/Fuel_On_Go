export interface Coord {
  lat: number;
  lng: number;
}

export function isValidCoord(lat: unknown, lng: unknown): boolean {
  const a = Number(lat);
  const b = Number(lng);
  return (
    lat !== null && lng !== null && lat !== '' && lng !== '' &&
    Number.isFinite(a) && Number.isFinite(b) &&
    Math.abs(a) <= 90 && Math.abs(b) <= 180 &&
    !(a === 0 && b === 0) // "null island" is a bogus fix, never a pump or a person in Maharashtra
  );
}

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle (straight-line) distance in metres. Arguments are (lat, lng) pairs. */
export function haversineM(a: Coord, b: Coord): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function movedMoreThan(a: Coord | null, b: Coord | null, metres: number): boolean {
  if (!a || !b) return true;
  return haversineM(a, b) > metres;
}

/** Straight-line distance for display. Never implies road distance. */
export function formatStraightLine(km?: number | null): string {
  if (typeof km !== 'number' || !Number.isFinite(km) || km < 0) return '-- km';
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

export interface PumpLike {
  id: string;
  lat: number;
  lng: number;
  distance_km?: number;
}

/**
 * Recomputes every pump's distance from the device and sorts nearest first.
 * With no usable device position the server's distance (measured from the
 * *browsed* area, not from the user) is dropped rather than shown as "yours".
 */
export function rankPumps<T extends PumpLike>(pumps: T[], device: Coord | null): T[] {
  if (!device || !isValidCoord(device.lat, device.lng)) {
    return pumps.map((p) => ({ ...p, distance_km: undefined }));
  }
  return pumps
    .map((p) => {
      const ok = isValidCoord(p.lat, p.lng);
      return {
        ...p,
        distance_km: ok ? haversineM(device, { lat: Number(p.lat), lng: Number(p.lng) }) / 1000 : undefined,
      };
    })
    .sort((a, b) => {
      if (a.distance_km === undefined) return 1;
      if (b.distance_km === undefined) return -1;
      return a.distance_km - b.distance_km;
    });
}
