import { useStore } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLangStore, type LangState } from './langStoreCore';

// One store for the whole app (customers and pump owners). Storage rules live in langStoreCore.ts.
export const langStore = createLangStore(AsyncStorage);

export const useLangStore = <T,>(selector: (s: LangState) => T): T => useStore(langStore, selector);
