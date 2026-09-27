import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '../services/auth.service';
import { API_URL } from '../config/constants';

export type UserRole = 'user' | 'pump_owner' | 'admin';

export interface AppUser {
  id: string;
  phone: string;
  name: string;
  email?: string | null;
  role: UserRole;
  vehicle_number?: string | null;
  vehicle_type?: string | null;
  trust_score: number;
  no_show_count: number;
  is_blocked: boolean;
  expo_push_token?: string | null;
  created_at: string;
}

export type PendingFlow = 'user' | 'pump_owner';

export interface PendingAuth {
  phone: string;
  flow: PendingFlow;
  name?: string | null;
  isNew?: boolean;
}

interface AuthState {
  token: string | null;
  user: AppUser | null;
  pendingAuth: PendingAuth | null;
  loading: boolean;
  isAuthenticated: boolean;

  rehydrateAuth: () => Promise<void>;
  setPendingAuth: (pending: PendingAuth | null) => Promise<void>;
  setSession: (token: string, user: AppUser) => Promise<void>;
  updateUser: (patch: Partial<AppUser>) => Promise<void>;
  sendOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, code: string) => Promise<{ is_new: boolean; user: AppUser }>;
  register: (payload: {
    name: string;
    vehicle_number: string;
    vehicle_type: string;
    role: UserRole;
  }) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  pendingAuth: null,
  loading: true,          // starts true — hides app until rehydration completes
  isAuthenticated: false,

  async rehydrateAuth() {
    try {
      console.log('[AuthStore] Rehydrating...');

      // ── One-time stale session clear ──────────────────────────────────────
      // Clears any session stored under the OLD key format from previous builds.
      // Remove this block once all test devices have been updated.
      try {
        const cleared = await AsyncStorage.getItem('session_cleared_v3');
        if (!cleared) {
          await SecureStore.deleteItemAsync('token');
          await SecureStore.deleteItemAsync('user');
          await SecureStore.deleteItemAsync('pendingAuth');
          await AsyncStorage.setItem('session_cleared_v3', 'true');
          console.log('[AuthStore] One-time stale session cleared.');
          set({ token: null, user: null, pendingAuth: null, isAuthenticated: false, loading: false });
          return;
        }
      } catch (_clearErr) {
        // Ignore errors from the one-time clear
      }
      // ─────────────────────────────────────────────────────────────────────

      const token = await SecureStore.getItemAsync('token');
      const userStr = await SecureStore.getItemAsync('user');
      const pending = await SecureStore.getItemAsync('pendingAuth');

      if (pending) {
        try { set({ pendingAuth: JSON.parse(pending) }); } catch (_) {}
      }

      if (!token || !userStr) {
        console.log('[AuthStore] No stored session — showing Welcome.');
        set({ token: null, user: null, isAuthenticated: false, loading: false });
        return;
      }

      // Validate token against the server
      const controller = new AbortController();
      const validationTimeout = setTimeout(() => controller.abort(), 4000);
      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });

        if (response.ok) {
          const data = await response.json();
          // /auth/me returns the user object directly (not wrapped in { user })
          const freshUser: AppUser = data.user ?? data;
          console.log('[AuthStore] Token valid, role:', freshUser.role);
          set({ token, user: freshUser, isAuthenticated: true, loading: false });
          // Refresh cached user in SecureStore
          await SecureStore.setItemAsync('user', JSON.stringify(freshUser));
        } else {
          // Token rejected by server — clear everything
          console.log('[AuthStore] Token invalid (', response.status, ') — clearing session.');
          await SecureStore.deleteItemAsync('token');
          await SecureStore.deleteItemAsync('user');
          set({ token: null, user: null, isAuthenticated: false, loading: false });
        }
      } catch (networkErr) {
        // Network unreachable — trust cached user so offline usage still works
        console.warn('[AuthStore] Network error during token validation — using cache:', networkErr);
        try {
          const cachedUser: AppUser = JSON.parse(userStr);
          set({ token, user: cachedUser, isAuthenticated: true, loading: false });
        } catch (_) {
          set({ token: null, user: null, isAuthenticated: false, loading: false });
        }
      } finally {
        clearTimeout(validationTimeout);
      }

      console.log('[AuthStore] Rehydration complete.');
    } catch (error) {
      console.error('[AuthStore] Rehydration failed:', error);
      set({ token: null, user: null, isAuthenticated: false, loading: false });
    }
  },

  async setPendingAuth(pending) {
    set({ pendingAuth: pending });
    if (pending) await SecureStore.setItemAsync('pendingAuth', JSON.stringify(pending));
    else await SecureStore.deleteItemAsync('pendingAuth');
  },

  async setSession(token, user) {
    set({ token, user, isAuthenticated: true, loading: false });
    await SecureStore.setItemAsync('token', token);
    await SecureStore.setItemAsync('user', JSON.stringify(user));
  },

  async updateUser(patch) {
    const user = get().user;
    if (user) {
      const updatedUser = { ...user, ...patch };
      set({ user: updatedUser });
      await SecureStore.setItemAsync('user', JSON.stringify(updatedUser));
    }
  },

  async sendOtp(phone) {
    await authService.sendOtp(phone);
  },

  async verifyOtp(phone, code) {
    const normalized = authService.normalizePhone(phone);
    const pending = get().pendingAuth;
    const data = await authService.verifyOtp(normalized, code);
    await get().setSession(data.token, data.user);
    await get().setPendingAuth(null);
    return { is_new: !!pending?.isNew, user: data.user };
  },

  async register(payload) {
    const pending = get().pendingAuth;
    if (!pending?.phone) throw new Error('Missing pending phone for registration');

    if (pending.flow === 'pump_owner') {
      await authService.registerAdmin({
        phone: pending.phone,
        name: payload.name,
        email: 'owner@fuelongo.app',
        business_name: 'Fuel on Go Pump',
      });
    } else {
      await authService.registerUser({
        phone: pending.phone,
        name: payload.name,
        vehicle_number: payload.vehicle_number,
        vehicle_type: payload.vehicle_type as 'Car' | 'Auto' | 'Bus' | 'Other',
      });
    }
  },

  async logout() {
    set({ token: null, user: null, pendingAuth: null, isAuthenticated: false, loading: false });
    await SecureStore.deleteItemAsync('token');
    await SecureStore.deleteItemAsync('user');
    await SecureStore.deleteItemAsync('pendingAuth');
  },
}));
