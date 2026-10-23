// Reverse geocoding (Nominatim, the same service the place search already uses).
export interface Area {
  name: string; // locality shown in the header, e.g. "Vishrambag"
  city: string;
  district: string;
  displayName: string; // full address line
}

export function parseReverse(data: any): Area | null {
  const addr = data?.address;
  if (!addr || typeof addr !== 'object') return null;
  const locality =
    addr.suburb || addr.neighbourhood || addr.city_district || addr.quarter ||
    addr.village || addr.town || addr.city || addr.county;
  if (!locality) return null; // never invent a locality name
  const city = addr.city || addr.town || addr.village || addr.county || locality;
  return {
    name: String(locality),
    city: String(city),
    district: String(addr.state_district || addr.county || city),
    displayName: String(data.display_name || locality),
  };
}

export async function reverseGeocode(lat: number, lng: number, signal?: AbortSignal): Promise<Area> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=16`,
    { headers: { 'Accept-Language': 'en', 'User-Agent': 'FuelOnGoApp/1.0' }, signal }
  );
  if (!res.ok) throw new Error(`reverse geocode ${res.status}`);
  const area = parseReverse(await res.json());
  if (!area) throw new Error('no locality for coordinates');
  return area;
}

export interface AddressDetails {
  displayName: string;
  city: string;
  district: string;
  postcode: string;
}

// Looser than reverseGeocode(): a pump on a rural road may have no "locality",
// but its address line is still useful. Never throws for "no locality".
export async function reverseAddress(lat: number, lng: number, signal?: AbortSignal): Promise<AddressDetails> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=18`,
    { headers: { 'Accept-Language': 'en', 'User-Agent': 'FuelOnGoApp/1.0' }, signal }
  );
  if (!res.ok) throw new Error(`reverse geocode ${res.status}`);
  const data = await res.json();
  if (!data?.display_name) throw new Error('no address for coordinates');
  const a = data.address || {};
  const city = a.city || a.town || a.village || a.suburb || a.county || '';
  return {
    displayName: String(data.display_name),
    city: String(city),
    district: String(a.state_district || a.county || city || ''),
    postcode: String(a.postcode || ''),
  };
}
