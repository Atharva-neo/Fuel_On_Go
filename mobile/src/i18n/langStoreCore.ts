import { createStore } from 'zustand/vanilla';
import { DEFAULT_LANGUAGE, parseLanguage, type Language } from './core.ts';

export interface LangStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<unknown>;
}

// Language preference storage:
//   fuelongo.lang.v1.device       chosen before login (onboarding); default for accounts with no choice
//   fuelongo.lang.v1.user.<id>    chosen while signed in; applies to that account only
// A signed-in choice never touches the device key, so another account on the same phone is unaffected.
export const DEVICE_KEY = 'fuelongo.lang.v1.device';
export const userKey = (id: string) => `fuelongo.lang.v1.user.${id}`;

export interface LangState {
  language: Language;
  userId: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setUser: (id: string | null) => Promise<void>;
  setLanguage: (lang: Language) => void;
}

async function read(storage: LangStorage, key: string): Promise<Language | null> {
  try {
    return parseLanguage(await storage.getItem(key));
  } catch {
    return null;
  }
}

export function createLangStore(storage: LangStorage) {
  return createStore<LangState>((set, get) => ({
  language: DEFAULT_LANGUAGE,
  userId: null,
  hydrated: false,

  hydrate: async () => {
    const device = await read(storage, DEVICE_KEY);
    set({ language: device || DEFAULT_LANGUAGE, hydrated: true });
  },

  setUser: async (id) => {
    set({ userId: id });
    const device = await read(storage, DEVICE_KEY);
    const own = id ? await read(storage, userKey(id)) : null;
    // ignore a stale result if the user changed again meanwhile
    if (get().userId === id) set({ language: own || device || DEFAULT_LANGUAGE });
  },

  setLanguage: (language) => {
    set({ language });
    const { userId } = get();
    storage.setItem(userId ? userKey(userId) : DEVICE_KEY, language).catch(() => {});
  },
}));
}

