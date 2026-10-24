import type { Params } from './core.ts';
import { formatNumber } from './format.ts';
import type { Language } from './core.ts';

type Tr = (key: string, params?: Params) => string;

/** Straight-line distance label in the active language ("340 m" / "2.4 km"); same rounding as the numeric formatter. */
export function distanceLabel(km: number | null | undefined, tr: Tr, language: Language): string {
  if (typeof km !== 'number' || !Number.isFinite(km) || km < 0) return tr('common.distanceUnknown');
  if (km < 1) return tr('common.meters', { value: formatNumber(Math.max(10, Math.round((km * 1000) / 10) * 10), language) });
  const v = km < 10 ? Number(km.toFixed(1)) : Math.round(km);
  return tr('common.km', { value: formatNumber(v, language, { maximumFractionDigits: 1 }) });
}
