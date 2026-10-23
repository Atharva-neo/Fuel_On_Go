// App-wide singleton + React bindings. Screens never talk to expo-location.
import { useEffect, useRef } from 'react';
import { AppState, Linking } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useStore } from 'zustand';
import { createLocationController } from './controller.ts';
import type { LocationState } from './controller.ts';
import { expoLocationProvider } from './expoProvider.ts';
import { reverseGeocode } from './area.ts';

export const locationController = createLocationController({
  provider: expoLocationProvider,
  reverseGeocode,
});

let appStateHooked = false;
function hookAppState() {
  if (appStateHooked) return;
  appStateHooked = true;
  AppState.addEventListener('change', (s) => locationController.setAppActive(s === 'active'));
}

/** Read the shared device-location state (reading never starts GPS). */
export function useDeviceLocation(): LocationState {
  return useStore(locationController.store);
}

/**
 * Keep GPS running while the calling screen is mounted AND focused.
 * Any number of screens may call this; only one native session exists.
 */
export function useLocationSession(enabled = true) {
  const focused = useIsFocused();
  const active = enabled && focused;
  const release = useRef<null | (() => void)>(null);
  useEffect(() => {
    hookAppState();
    if (active && !release.current) release.current = locationController.acquire();
    if (!active && release.current) {
      release.current();
      release.current = null;
    }
    return () => {
      release.current?.();
      release.current = null;
    };
  }, [active]);
}

export function openLocationSettings() {
  return Linking.openSettings();
}

export function describeLocationProblem(
  s: Pick<LocationState, 'error' | 'fix' | 'isFresh' | 'lowAccuracy'>
): string | null {
  switch (s.error) {
    case 'permission_denied':
      return 'Location permission is off. Allow it to see pumps near you.';
    case 'permission_blocked':
      return 'Location is blocked for this app. Enable it in system settings.';
    case 'services_disabled':
      return 'Turn on device location (GPS) to see pumps near you.';
    case 'timeout':
      return 'Still looking for a GPS signal...';
    case 'unavailable':
      return "Couldn't read your location right now.";
  }
  if (s.fix && s.fix.source === 'cached') return 'Showing your last known position while GPS locks on...';
  if (s.fix && !s.isFresh) return 'Your location may be out of date.';
  if (s.lowAccuracy) return 'GPS accuracy is low. Move to an open area for a better fix.';
  return null;
}
