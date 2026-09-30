import * as Location from 'expo-location';

export interface DeviceLocation {
  lat: number;
  lng: number;
  city: string;
  district: string;
  displayName: string;
}

// Requests foreground location permission and returns the device's actual
// GPS position, reverse-geocoded (via the same free Nominatim service the
// place search already uses) into a city/district/displayName.
// Returns null if permission is denied or the fix fails, so callers can
// fall back to a sensible default instead of crashing.
export async function getCurrentDeviceLocation(): Promise<DeviceLocation | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      const addr = data?.address || {};
      const city = addr.city || addr.town || addr.village || addr.county || 'Current Location';
      const district = addr.state_district || addr.county || city;
      return { lat, lng, city, district, displayName: data?.display_name || city };
    } catch {
      // Reverse geocoding failed, but we still have real coordinates.
      return { lat, lng, city: 'Current Location', district: 'Current Location', displayName: 'Current Location' };
    }
  } catch {
    return null;
  }
}
