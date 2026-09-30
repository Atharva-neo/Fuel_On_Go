import api from '../config/api';
import type { Booking } from './booking.service';

export interface AdminStats {
  booked: number;
  arrived: number;
  no_shows: number;
  revenue: number;
}

export const adminService = {
  async getMyPump() {
    const { data } = await api.get('/pumps/my-pump');
    return data;
  },

  async getMyBookings(date: string): Promise<Booking[]> {
    const { data } = await api.get('/pumps/my-bookings', { params: { date } });
    return data;
  },

  async checkin(qrToken: string) {
    const { data } = await api.post('/bookings/checkin-by-admin', { qr_token: qrToken });
    return data;
  },

  async updatePump(pumpId: string, payload: {
    name?: string;
    address?: string;
    city?: string;
    district?: string;
    pin_code?: string;
    working_hours_start?: string;
    working_hours_end?: string;
    vehicles_per_slot?: number;
    cng_price_per_kg?: number;
    fuel_density?: number;
    supply_status?: 'available' | 'low' | 'interrupted';
    public_message?: string;
    lat?: number;
    lng?: number;
  }) {
    const { data } = await api.patch(`/admin/pumps/${pumpId}`, payload);
    return data;
  },

  async exportBookingsCsv(params?: { date?: string; status?: string }): Promise<string> {
    const { data } = await api.get('/admin/bookings/export', {
      params,
      responseType: 'text',
      transformResponse: (r) => r, // keep raw CSV text, don't let axios try to JSON-parse it
    });
    return data as unknown as string;
  },
};
