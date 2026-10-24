// Locale-aware formatting. Underlying values (numbers, ISO dates, "HH:MM") never change; only how
// they are shown. Hermes ships Intl on Android; every call falls back to a plain format.
import type { Language } from './core.ts';
import { LANGUAGES } from './core.ts';

// Latin digits in every language so numbers look the same in prices, counts and times (and match
// the digits already embedded in translated sentences). Grouping and month names still follow the locale.
const localeOf = (lang: Language) => `${LANGUAGES.find((l) => l.code === lang)?.locale || 'en-IN'}-u-nu-latn`;

export function formatNumber(value: number, lang: Language, opts?: Intl.NumberFormatOptions): string {
  try {
    return new Intl.NumberFormat(localeOf(lang), opts).format(value);
  } catch {
    return String(value);
  }
}

/** Rupees with Indian digit grouping. */
export function formatRupees(value: number, lang: Language, fractionDigits = 2): string {
  return `₹${formatNumber(Number(value) || 0, lang, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })}`;
}

export function formatDistanceKm(km: number, lang: Language): string {
  return formatNumber(km, lang, { maximumFractionDigits: 1 });
}

/** "2026-10-24" -> localized medium date. Calendar date only, no time-zone shift. */
export function formatDate(iso: string, lang: Language): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  if (!m) return String(iso);
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  try {
    return new Intl.DateTimeFormat(localeOf(lang), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(d);
  } catch {
    return `${m[3]}-${m[2]}-${m[1]}`;
  }
}

/** "18:15:00" / "18:15" -> 12-hour clock in the locale. */
export function formatClock(raw: string, lang: Language): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(raw));
  if (!m) return String(raw);
  const h = +m[1] % 24;
  const d = new Date(Date.UTC(2000, 0, 1, h, +m[2]));
  try {
    return new Intl.DateTimeFormat(localeOf(lang), { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' }).format(d);
  } catch {
    return `${String(h).padStart(2, '0')}:${m[2]}`;
  }
}

/** Wall-clock time of an instant (ISO timestamp) in India, 12-hour, in the locale. */
export function formatInstantTime(iso: string, lang: Language): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return String(iso);
  try {
    return new Intl.DateTimeFormat(localeOf(lang), { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }).format(d);
  } catch {
    return d.toISOString();
  }
}
