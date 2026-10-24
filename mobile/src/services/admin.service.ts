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

  async approveBooking(bookingId: string) {
    const { data } = await api.patch(`/bookings/${bookingId}/approve`);
    return data;
  },

  async rejectBooking(bookingId: string, reason?: string) {
    const { data } = await api.patch(`/bookings/${bookingId}/reject`, { reason });
    return data;
  },

  async markNoShow(bookingId: string) {
    const { data } = await api.post(`/bookings/${bookingId}/no-show`);
    return data;
  },

  /** One page of the owner's booking history (same filter code as the CSV export on the server). */
  async getBookingHistory(params: { date?: string; from?: string; to?: string; status?: string; limit?: number; offset?: number }) {
    const { data } = await api.get('/admin/bookings/history', { params });
    return data as { items: any[]; total: number; has_more: boolean; limit: number; offset: number };
  },

  async exportBookingsCsv(params?: { date?: string; from?: string; to?: string; status?: string }): Promise<string> {
    const { data } = await api.get('/admin/bookings/export', {
      params,
      responseType: 'text',
      transformResponse: (r) => r, // keep raw CSV text, don't let axios try to JSON-parse it
    });
    return data as unknown as string;
  },
};
