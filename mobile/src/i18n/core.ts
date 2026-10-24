// Platform-free translation core (no React / React Native imports) so it is unit-testable.
// Keys are stable dotted ids ("booking.cancel"). Values may contain {{name}} placeholders.
// Plurals use "_one" / "_other" key suffixes and a `count` param.

export type Language = 'en' | 'hi' | 'mr';
export const LANGUAGES: Array<{ code: Language; native: string; english: string; locale: string }> = [
  { code: 'en', native: 'English', english: 'English', locale: 'en-IN' },
  { code: 'hi', native: 'हिन्दी', english: 'Hindi', locale: 'hi-IN' },
  { code: 'mr', native: 'मराठी', english: 'Marathi', locale: 'mr-IN' },
];
export const DEFAULT_LANGUAGE: Language = 'en';

export type Dict = Record<string, string>;
export type Params = Record<string, string | number>;

export function parseLanguage(raw: unknown): Language | null {
  return raw === 'en' || raw === 'hi' || raw === 'mr' ? raw : null;
}

/** Nested object -> flat "a.b.c" keys. */
export function flatten(obj: Record<string, any>, prefix = ''): Dict {
  const out: Dict = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else if (v && typeof v === 'object') Object.assign(out, flatten(v, key));
  }
  return out;
}

export function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, name) => (name in params ? String(params[name]) : m));
}

export function makeTranslator(
  dicts: Record<Language, Dict>,
  language: Language,
  onMissing?: (key: string, language: Language) => void
) {
  return (key: string, params?: Params): string => {
    let k = key;
    if (params && typeof params.count === 'number') {
      const plural = `${key}_${params.count === 1 ? 'one' : 'other'}`;
      if (plural in dicts[language] || plural in dicts.en) k = plural;
    }
    let value = dicts[language][k];
    if (value === undefined) {
      onMissing?.(k, language);
      value = dicts.en[k];
    }
    if (value === undefined) return key; // visible, never crashes
    return interpolate(value, params);
  };
}

/** Keys present in `base` but missing in `other`, extras, and placeholder mismatches. */
export function diffDicts(base: Dict, other: Dict) {
  const missing = Object.keys(base).filter((k) => !(k in other));
  const extra = Object.keys(other).filter((k) => !(k in base));
  const names = (s: string) => [...s.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort().join(',');
  const placeholderMismatch = Object.keys(base).filter((k) => k in other && names(base[k]) !== names(other[k]));
  return { missing, extra, placeholderMismatch };
}
