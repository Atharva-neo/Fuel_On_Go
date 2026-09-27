import api from '../config/api';
import type { LocationBbox } from '../store/locationStore';

export interface Pump {
  id: string;
  owner_id?: string;
  name: string;
  address: string;
  city: string;
  district: string;
  state?: string;
  lat: number;
  lng: number;
  working_hours_start: string;
  working_hours_end: string;
  vehicles_per_slot: number;
  cng_price_per_kg: number;
  fuel_density: number;
  supply_status?: 'available' | 'low' | 'interrupted';
  public_message?: string | null;
  is_active: boolean;
  rating?: number;
  available_slots_today?: number;
  distance_km?: number;
}

export interface PumpStats {
  booked: number;
  arrived: number;
  no_shows: number;
  revenue: number;
}

export interface MyPumpResponse {
  pump: Pump | null;
  stats: PumpStats;
}

function toRegionParams(bbox?: LocationBbox | null) {
  if (!bbox) return {};
  return {
    north: bbox.north,
    south: bbox.south,
    east: bbox.east,
    west: bbox.west,
  };
}

export const pumpService = {
  async getNearby(params: {
    lat: number;
    lng: number;
    radius?: number;
    bbox?: LocationBbox | null;
  }): Promise<Pump[]> {
    const { data } = await api.get('/pumps/nearby', {
      params: {
        lat: params.lat,
        lng: params.lng,
        radius: params.radius ?? 30000,
        ...toRegionParams(params.bbox),
      },
    });
    return data;
  },

  async getPump(pumpId: string): Promise<Pump> {
    const { data } = await api.get(`/pumps/${pumpId}`);
    return data;
  },

  async registerPump(payload: {
    name: string;
    license_number: string;
    address: string;
    city: string;
    district: string;
    pin_code?: string;
    lat: number;
    lng: number;
    working_hours_start: string;
    working_hours_end: string;
    vehicles_per_slot: number;
    cng_price_per_kg: number;
  }): Promise<Pump> {
    const { data } = await api.post('/pumps/create', payload);
    return data;
  },

  async getMyPump(): Promise<MyPumpResponse> {
    const { data } = await api.get('/pumps/my-pump');
    return data;
  },

  async getMyBookings(date: string) {
    const { data } = await api.get('/pumps/my-bookings', { params: { date } });
    return data;
  },

  async joinWaitlist(payload: { pump_id: string; slot_date?: string; note?: string }) {
    const { data } = await api.post('/waitlist', payload);
    return data;
  },
};
