// Pure display/validation helpers for pump ratings (no React, unit-tested).

export const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'] as const;

export const RATING_TAGS = [
  { id: 'fast_service', label: 'Fast service', positive: true },
  { id: 'short_wait', label: 'Short waiting time', positive: true },
  { id: 'clean_facility', label: 'Clean facility', positive: true },
  { id: 'helpful_staff', label: 'Helpful staff', positive: true },
  { id: 'fair_pricing', label: 'Fair pricing', positive: true },
  { id: 'long_wait', label: 'Long waiting time', positive: false },
  { id: 'poor_service', label: 'Poor service', positive: false },
] as const;

export type RatingTagId = (typeof RATING_TAGS)[number]['id'];
export const MAX_REVIEW_CHARS = 1000;
export const MAX_TAGS = 5;

export function tagLabel(id: string): string {
  return RATING_TAGS.find((t) => t.id === id)?.label ?? id;
}

export interface RatingSummary {
  average: number | null;
  count: number;
}

/**
 * What to show next to a pump. A pump with no reviews has NO rating:
 * it is never shown as 0, as a default, or as 5 stars.
 */
export function formatRatingSummary(average: number | null | undefined, count: number | null | undefined) {
  const n = Number(count) || 0;
  if (n <= 0 || average == null || !Number.isFinite(Number(average))) {
    return { hasRating: false as const, short: 'New', long: 'No reviews yet', a11y: 'No reviews yet' };
  }
  const avg = Math.round(Number(average) * 10) / 10;
  const reviews = `${n} ${n === 1 ? 'review' : 'reviews'}`;
  return {
    hasRating: true as const,
    short: `${avg.toFixed(1)} (${n})`,
    long: `${avg.toFixed(1)} - ${reviews}`,
    a11y: `Rated ${avg.toFixed(1)} out of 5 from ${reviews}`,
    average: avg,
  };
}

/** Per-star fill for a display row: 'full' | 'half' | 'empty'. */
export function starFills(average: number | null | undefined): Array<'full' | 'half' | 'empty'> {
  const a = average == null ? 0 : Math.max(0, Math.min(5, Number(average)));
  return [1, 2, 3, 4, 5].map((i) => (a >= i - 0.25 ? 'full' : a >= i - 0.75 ? 'half' : 'empty'));
}

export function canSubmitRating(draft: { rating: number; review: string }): boolean {
  return Number.isInteger(draft.rating) && draft.rating >= 1 && draft.rating <= 5 && draft.review.length <= MAX_REVIEW_CHARS;
}

/** Keyboard/accessibility step for the star control (arrow keys, increment/decrement actions). */
export function stepRating(current: number, delta: 1 | -1): number {
  return Math.max(1, Math.min(5, (current || 0) + delta));
}

export function toggleTag(tags: string[], id: string): string[] {
  if (tags.includes(id)) return tags.filter((t) => t !== id);
  return tags.length >= MAX_TAGS ? tags : [...tags, id];
}

export type RateActionState = 'hidden' | 'rate' | 'edit' | 'rated';

/**
 * What the rating row on a booking card shows.
 *  hidden - not eligible (not a completed visit, own pump, ...): no actionable button
 *  rate   - eligible and not yet rated (also when the eligibility check failed on a completed visit)
 *  edit   - already rated and still editable
 *  rated  - already rated, read-only (no second submission is offered)
 */
export function rateActionState(
  elig: { eligible: boolean; rating: { editable: boolean } | null } | null,
  checkFailed = false
): RateActionState {
  if (!elig) return checkFailed ? 'rate' : 'hidden';
  if (!elig.eligible) return 'hidden';
  if (!elig.rating) return 'rate';
  return elig.rating.editable ? 'edit' : 'rated';
}
