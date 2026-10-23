import * as Location from 'expo-location';
import type { LocationProvider, PermissionStatus, RawFix } from './controller.ts';

function mapPermission(r: Location.LocationPermissionResponse): PermissionStatus {
  if (r.granted) return 'granted';
  if (r.status === Location.PermissionStatus.UNDETERMINED) return 'undetermined';
  return r.canAskAgain ? 'denied' : 'blocked';
}

function toRaw(p: Location.LocationObject): RawFix {
  return {
    lat: p.coords.latitude,
    lng: p.coords.longitude,
    accuracy: p.coords.accuracy ?? null,
    timestamp: p.timestamp || Date.now(),
  };
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'TIMEOUT' })), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(Object.assign(new Error(e?.message || 'unavailable'), { code: 'UNAVAILABLE' }));
      }
    );
  });
}

// Foreground location only: no background permission is requested.
export const expoLocationProvider: LocationProvider = {
  async getPermission() {
    return { status: mapPermission(await Location.getForegroundPermissionsAsync()) };
  },
  async requestPermission() {
    return { status: mapPermission(await Location.requestForegroundPermissionsAsync()) };
  },
  servicesEnabled: () => Location.hasServicesEnabledAsync(),
  async getLastKnown() {
    const p = await Location.getLastKnownPositionAsync();
    return p ? toRaw(p) : null;
  },
  async getCurrent(timeoutMs, highAccuracy) {
    return toRaw(
      await withTimeout(Location.getCurrentPositionAsync({
          accuracy: highAccuracy ? Location.Accuracy.High : Location.Accuracy.Balanced,
        }), timeoutMs)
    );
  },
  async watch(opts, onFix, onError) {
    try {
      return await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: opts.timeIntervalMs,
          distanceInterval: opts.distanceIntervalM,
        },
        (p) => onFix(toRaw(p))
      );
    } catch (e: any) {
      onError(e);
      return { remove() {} };
    }
  },
};
