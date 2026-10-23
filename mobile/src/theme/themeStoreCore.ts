// Platform-free theme preference store (storage is injected) so persistence is unit-testable.
import { createStore } from 'zustand/vanilla';
import { parsePreference, type ThemePreference } from './resolve.ts';

export interface ThemeStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<unknown>;
}

export interface ThemeState {
  preference: ThemePreference;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setPreference: (p: ThemePreference) => void;
  /** Flip to the other palette from whichever one is showing now. */
  toggle: (currentIsDark: boolean) => void;
}

export const THEME_STORAGE_KEY = 'fuelongo.theme.v1';

export function createThemeStore(storage: ThemeStorage) {
  const save = (p: ThemePreference) => {
    storage.setItem(THEME_STORAGE_KEY, p).catch(() => {});
  };
  return createStore<ThemeState>((set) => ({
    preference: 'system',
    hydrated: false,

    hydrate: async () => {
      try {
        set({ preference: parsePreference(await storage.getItem(THEME_STORAGE_KEY)), hydrated: true });
      } catch {
        set({ hydrated: true }); // unreadable storage: fall back to the OS theme, never block startup
      }
    },

    setPreference: (preference) => {
      set({ preference });
      save(preference);
    },

    toggle: (currentIsDark) => {
      const preference: ThemePreference = currentIsDark ? 'light' : 'dark';
      set({ preference });
      save(preference);
    },
  }));
}
