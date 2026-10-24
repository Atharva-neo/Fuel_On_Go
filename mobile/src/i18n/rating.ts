import type { Language, Params } from './core';
import { formatNumber } from './format';
import { formatRatingSummary } from '../ratings/ratingModel';

type Tr = (key: string, params?: Params) => string;

/** Localized version of formatRatingSummary: same rounding and the same "no reviews is not a rating" rule. */
export function ratingText(average: number | null | undefined, count: number | null | undefined, tr: Tr, language: Language) {
  const s = formatRatingSummary(average, count);
  if (!s.hasRating) {
    return { hasRating: false as const, short: tr('rating.new'), long: tr('rating.noReviews'), a11y: tr('rating.noReviews'), average: null, count: 0 };
  }
  const n = Number(count) || 0;
  const avg = formatNumber(s.average, language, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const reviews = tr('rating.reviewCount', { count: n, n: formatNumber(n, language) });
  return {
    hasRating: true as const,
    short: `${avg} (${formatNumber(n, language)})`,
    long: `${avg} - ${reviews}`,
    a11y: tr('rating.a11ySummary', { avg, reviews }),
    average: s.average,
    count: n,
  };
}
