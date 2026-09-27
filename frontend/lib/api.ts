import { API_BASE_URL } from './config';

const API_BASE = API_BASE_URL;
const API_TIMEOUT = 30000;

let serverOffsetMs = 0;
let serverSynced = false;

type ApiMeta = {
  serverTime?: string;
  [key: string]: unknown;
};

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data: T;
  details?: unknown;
  meta?: ApiMeta;
};

function syncServerTime(serverTime?: string | null) {
  if (!serverTime) return;
  const parsed = new Date(serverTime).getTime();
  if (!Number.isFinite(parsed)) return;
  serverOffsetMs = parsed - Date.now();
  serverSynced = true;
}

export function getServerNow() {
  const now = Date.now();
  return new Date(serverSynced ? now + serverOffsetMs : now);
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      cache: 'no-store',
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    const serverTimeHeader = response.headers.get('x-server-time');
    syncServerTime(serverTimeHeader);

    let payload: ApiEnvelope<T> | null = null;
    try {
      payload = (await response.json()) as ApiEnvelope<T>;
    } catch {
      throw new Error('Invalid server response. Please try again.');
    }

    syncServerTime(payload.meta?.serverTime);

    if (!response.ok || !payload.success) {
      const errorMsg = payload.message || 'Request failed. Please try again.';
      throw new Error(errorMsg);
    }

    return payload.data;
  } catch (error) {
    if (error instanceof TypeError && error.name === 'AbortError') {
      throw new Error('Request timeout. Please check your connection and try again.');
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unexpected error occurred. Please try again.');
  } finally {
    clearTimeout(timeoutId);
  }
}

export type AvailabilityStatus = 'available' | 'medium' | 'low';
export type SlotStatus = 'open' | 'filling' | 'full';

export interface Pump {
  _id: string;
  name: string;
  address: string;
  location: { lat: number; lng: number };
  cngLevel: number;
  isActive: boolean;
  operatorName: string;
  phone: string;
  operatingHours: { open: string; close: string };
  slotDuration: number;
  slotCapacity: number;
  availabilityStatus: AvailabilityStatus;
}

export interface Slot {
  _id: string;
  pumpId: string;
  startTime: string;
  endTime: string;
  capacity: number;
  booked: number;
  available: number;
  status: SlotStatus;
  isActive: boolean;
}

export type BookingStatus = 'confirmed' | 'checked_in' | 'completed' | 'cancelled' | 'expired';

export interface Booking {
  _id: string;
  slotId: Slot;
  pumpId: Pump;
  userName: string;
  phone: string;
  vehicleNumber: string;
  vehicleType: 'Car' | 'Auto' | 'Bus' | 'Other';
  token: string;
  tokenNumber: number;
  qrCode: string;
  status: BookingStatus;
  createdAt: string;
  checkedInAt?: string;
}

export const api = {
  pumps: {
    list: () => apiFetch<Pump[]>('/pumps'),
    get: (id: string) => apiFetch<Pump>(`/pumps/${id}`),
    slots: (id: string, date?: string) =>
      apiFetch<Slot[]>(`/pumps/${id}/slots${date ? `?date=${date}` : ''}`),
    updateAvailability: (
      id: string,
      data: { cngLevel?: number; isActive?: boolean },
      token: string
    ) =>
      apiFetch<Pump>(`/pumps/${id}/availability`, {
        method: 'PUT',
        body: JSON.stringify(data),
        headers: { Authorization: `Bearer ${token}` },
      }),
  },
  bookings: {
    create: (data: {
      slotId: string;
      pumpId: string;
      userName: string;
      phone: string;
      vehicleNumber: string;
      vehicleType?: 'Car' | 'Auto' | 'Bus' | 'Other';
    }) => apiFetch<Booking>('/bookings', { method: 'POST', body: JSON.stringify(data) }),
    get: (id: string) => apiFetch<Booking>(`/bookings/${id}`),
    cancel: (id: string) => apiFetch<{ bookingId: string }>(`/bookings/${id}`, { method: 'DELETE' }),
    checkIn: (id: string) => apiFetch<Booking>(`/bookings/${id}/checkin`, { method: 'PUT' }),
  },
  admin: {
    login: (phone: string, password: string) =>
      apiFetch<{ token: string; user: { id: string; name: string; role: string; pumpId: string } }>(
        '/admin/login',
        { method: 'POST', body: JSON.stringify({ phone, password }) }
      ),
    dashboard: (token: string) =>
      apiFetch<{
        pump: Pump;
        totalBookings: number;
        confirmedBookings: number;
        slots: Slot[];
        recentBookings: Booking[];
      }>('/admin/dashboard', { headers: { Authorization: `Bearer ${token}` } }),
    updatePump: (id: string, data: Record<string, unknown>, token: string) =>
      apiFetch<Pump>(`/admin/pumps/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
        headers: { Authorization: `Bearer ${token}` },
      }),
    bookings: (
      token: string,
      query: { status?: BookingStatus; limit?: number; page?: number } = {}
    ) => {
      const params = new URLSearchParams();
      if (query.status) params.set('status', query.status);
      if (query.limit) params.set('limit', String(query.limit));
      if (query.page) params.set('page', String(query.page));
      return apiFetch<Booking[]>(
        `/admin/bookings${params.toString() ? `?${params.toString()}` : ''}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
    },
  },
};
