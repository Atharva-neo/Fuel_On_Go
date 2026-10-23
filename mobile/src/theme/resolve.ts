export type ThemePreference = 'system' | 'light' | 'dark';

/** Pure: which palette wins. 'system' follows the OS and falls back to dark. */
export function resolveThemeName(pref: ThemePreference, system: 'light' | 'dark' | null | undefined): 'mocha' | 'latte' {
  if (pref === 'light') return 'latte';
  if (pref === 'dark') return 'mocha';
  return system === 'light' ? 'latte' : 'mocha';
}

export function parsePreference(raw: string | null): ThemePreference {
  return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';
}

export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const c = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
