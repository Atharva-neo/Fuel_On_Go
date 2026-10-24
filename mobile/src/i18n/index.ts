import { useMemo } from 'react';
import { flatten, makeTranslator, type Dict, type Language, type Params } from './core';
import { langStore, useLangStore } from './store';
import { formatClock, formatInstantTime, formatDate, formatDistanceKm, formatNumber, formatRupees } from './format';
import { distanceLabel } from './distance';
import { ratingText } from './rating';
import en from './locales/en';
import hi from './locales/hi';
import mr from './locales/mr';

export { LANGUAGES, type Language } from './core';
export { langStore, useLangStore } from './store';

export const dictionaries: Record<Language, Dict> = { en: flatten(en), hi: flatten(hi), mr: flatten(mr) };

const warned = new Set<string>();
const onMissing = (key: string, language: Language) => {
  if (__DEV__ && !warned.has(`${language}:${key}`)) {
    warned.add(`${language}:${key}`);
    console.warn(`[i18n] missing "${key}" for ${language}`);
  }
};

/** Non-hook translate (alerts fired from async code, class components, error boundaries). */
export function translate(key: string, params?: Params): string {
  return makeTranslator(dictionaries, langStore.getState().language, onMissing)(key, params);
}

/** Re-renders the component when the language changes. */
export function useT() {
  const language = useLangStore((s) => s.language);
  const t = useMemo(() => makeTranslator(dictionaries, language, onMissing), [language]);
  const fmt = useMemo(
    () => ({
      number: (n: number) => formatNumber(n, language),
      rupees: (n: number, digits?: number) => formatRupees(n, language, digits),
      km: (n: number) => formatDistanceKm(n, language),
      date: (iso: string) => formatDate(iso, language),
      clock: (raw: string) => formatClock(raw, language),
      time: (iso: string) => formatInstantTime(iso, language),
      // "5 hours" / "3 दिन": largest whole unit, like date-fns formatDistanceToNowStrict.
      relative: (d: Date) => {
        const sec = Math.max(0, Math.round(Math.abs(d.getTime() - Date.now()) / 1000));
        const [unit, n] = sec < 60 ? ['second', sec] : sec < 3600 ? ['minute', Math.floor(sec / 60)] : sec < 86400 ? ['hour', Math.floor(sec / 3600)] : ['day', Math.floor(sec / 86400)];
        return t(`time.${unit}`, { count: n, n: formatNumber(n as number, language) });
      },
      rating: (average: number | null | undefined, count: number | null | undefined) => ratingText(average, count, t, language),
      distance: (km: number | null | undefined) => distanceLabel(km, t, language),
    }),
    [language, t]
  );
  return { tr: t, language, fmt };
}
