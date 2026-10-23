import { create } from 'zustand';

export interface LocationBbox {
  north: number;
  south: number;
  east: number;
  west: number;
}

// This store holds the area the user is *browsing* (a manually searched
// place). It is deliberately separate from the live device position, which
// lives in src/location (see controller.ts). `mode === 'device'` means "show
// me what is around my phone"; `'manual'` means a searched/selected area.
// Picking a manual area never touches the device's GPS coordinates.
interface LocationState {
  mode: 'device' | 'manual';
  lat: number | null;
  lng: number | null;
  city: string;
  district: string;
  displayName: string;
  bbox: LocationBbox | null;
  isSet: boolean;

  setLocation: (payload: {
    lat: number;
    lng: number;
    city: string;
    district?: string;
    displayName?: string;
    bbox?: LocationBbox | null;
  }) => void;
  /** Go back to following the device's real position. */
  followDevice: () => void;
  setBbox: (bbox: LocationBbox | null) => void;
  clear: () => void;
}

const DEVICE_MODE = {
  mode: 'device' as const,
  lat: null,
  lng: null,
  city: '',
  district: '',
  displayName: '',
  bbox: null,
};

export const useLocationStore = create<LocationState>((set) => ({
  ...DEVICE_MODE,
  isSet: false,

  setLocation: ({ lat, lng, city, district, displayName, bbox }) => {
    set({
      mode: 'manual',
      lat,
      lng,
      city,
      district: district ?? city,
      displayName: displayName ?? `${city}, Maharashtra`,
      bbox: bbox ?? null,
      isSet: true,
    });
  },

  followDevice: () => set({ ...DEVICE_MODE }),

  setBbox: (bbox) => {
    set({ bbox });
  },

  clear: () => {
    set({ ...DEVICE_MODE, isSet: false });
  },
}));
