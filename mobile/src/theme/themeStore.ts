import { useEffect, useState } from 'react';
import { Appearance } from 'react-native';
import { useStore } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { themes, type Theme } from './tokens';
import { resolveThemeName } from './resolve';
import { createThemeStore, type ThemeState } from './themeStoreCore';

export type { ThemePreference } from './resolve';

// One store for the whole app. User Mode and Owner Mode both read it, and the
// auth/role stores never touch it, so switching roles cannot reset the theme.
const store = createThemeStore(AsyncStorage);

// Works both as a hook (useThemeStore(selector)) and imperatively (useThemeStore.getState()).
export const useThemeStore = Object.assign(
  <T,>(selector: (s: ThemeState) => T): T => useStore(store, selector),
  { getState: store.getState, setState: store.setState, subscribe: store.subscribe }
);

function useSystemScheme(): 'light' | 'dark' | null {
  const [scheme, setScheme] = useState(Appearance.getColorScheme());
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => setScheme(colorScheme));
    return () => sub.remove();
  }, []);
  return scheme === 'light' || scheme === 'dark' ? scheme : null;
}

/** The resolved theme. Re-renders consumers when the preference or the OS theme changes. */
export function useTheme(): Theme {
  const preference = useThemeStore((s) => s.preference);
  const system = useSystemScheme();
  return themes[resolveThemeName(preference, system)];
}

/** Non-hook access for class components (error boundaries) and imperative code. */
export function getCurrentTheme(): Theme {
  const sys = Appearance.getColorScheme();
  return themes[resolveThemeName(store.getState().preference, sys === 'light' || sys === 'dark' ? sys : null)];
}
