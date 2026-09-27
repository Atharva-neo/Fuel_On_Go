import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LocalBooking {
  id: string;
  pumpId: string;
  pumpName: string;
  slotTime: string;
  tokenNumber: number;
  status: 'confirmed' | 'checked_in' | 'cancelled' | 'completed' | 'expired';
  createdAt: string;
  token?: string;
}

interface BookingState {
  bookings: LocalBooking[];
  addBooking: (booking: LocalBooking) => Promise<void>;
  cancelBooking: (id: string) => Promise<void>;
  loadBookings: () => Promise<void>;
}

const BOOKINGS_KEY = 'fuel_on_go_bookings';

export const useBookingStore = create<BookingState>((set, get) => ({
  bookings: [],

  addBooking: async (booking: LocalBooking) => {
    const updated = [booking, ...get().bookings];
    await AsyncStorage.setItem(BOOKINGS_KEY, JSON.stringify(updated));
    set({ bookings: updated });
  },

  cancelBooking: async (id: string) => {
    const updated = get().bookings.map((b) =>
      b.id === id ? { ...b, status: 'cancelled' as const } : b
    );
    await AsyncStorage.setItem(BOOKINGS_KEY, JSON.stringify(updated));
    set({ bookings: updated });
  },

  loadBookings: async () => {
    try {
      const raw = await AsyncStorage.getItem(BOOKINGS_KEY);
      if (raw) {
        set({ bookings: JSON.parse(raw) });
      }
    } catch {
      // ignore
    }
  },
}));
