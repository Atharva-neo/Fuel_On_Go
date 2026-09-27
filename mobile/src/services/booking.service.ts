import api from '../config/api';

export interface Booking {
  id: string;
  user_id: string;
  pump_id: string;
  slot_id: string;
  slot_date: string;
  slot_start: string;
  slot_end: string;
  status: 'confirmed' | 'arrived' | 'no_show' | 'cancelled';
  qr_token: string;
  booking_fee: number;
  total_estimated: number;
  amount_paid_now: number;
  pending_amount: number;
  fuel_payment_method: 'cash' | 'upi' | 'decided_later';
  payment_option: 'partial' | 'full';
  refund_amount?: number;
  created_at: string;

  pump_name?: string;
  pump_address?: string;
  pump_lat?: number;
  pump_lng?: number;
  user?: {
    id: string;
    name: string;
    phone: string;
    vehicle_number?: string;
  };
}

export interface CreateBookingPayload {
  pump_id: string;
  slot_id: string;
  slot_date: string;
  slot_start: string;
  slot_end: string;
  booking_fee: number;
  total_estimated: number;
  amount_paid_now: number;
  pending_amount: number;
  fuel_payment_method: 'cash' | 'upi' | 'decided_later';
  payment_option: 'partial' | 'full';
}

export const bookingService = {
  async createBooking(payload: CreateBookingPayload): Promise<Booking> {
    const { data } = await api.post('/bookings', payload);
    return data;
  },

  async getMyBookings(): Promise<Booking[]> {
    const { data } = await api.get('/bookings');
    return data;
  },

  async getBooking(id: string): Promise<Booking> {
    const { data } = await api.get(`/bookings/${id}`);
    return data;
  },

  async cancelBooking(id: string, refund: number = 0): Promise<Booking> {
    const { data } = await api.delete(`/bookings/${id}`, { data: { refund } });
    return data;
  },

  async checkinByAdmin(qrToken: string) {
    const { data } = await api.post('/bookings/checkin-by-admin', { qr_token: qrToken });
    return data;
  },
};
