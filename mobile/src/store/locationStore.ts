import { create } from 'zustand';

export interface LocationBbox {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface LocationState {
  lat: number;
  lng: number;
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
  setBbox: (bbox: LocationBbox | null) => void;
  clear: () => void;
}

const DEFAULT_LOCATION = {
  lat: 16.705,
  lng: 74.2433,
  city: 'Kolhapur',
  district: 'Kolhapur',
  displayName: 'Kolhapur, Maharashtra',
};

export const useLocationStore = create<LocationState>((set) => ({
  ...DEFAULT_LOCATION,
  bbox: null,
  isSet: false,

  setLocation: ({ lat, lng, city, district, displayName, bbox }) => {
    set({
      lat,
      lng,
      city,
      district: district ?? city,
      displayName: displayName ?? `${city}, Maharashtra`,
      bbox: bbox ?? null,
      isSet: true,
    });
  },

  setBbox: (bbox) => {
    set({ bbox });
  },

  clear: () => {
    set({ ...DEFAULT_LOCATION, bbox: null, isSet: false });
  },
}));
