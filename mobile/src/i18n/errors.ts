// Turns an axios/API error into text in the active language.
// The API contract is untouched: machine-readable `code` values stay as they are, and only their
// display text is localized here. Unknown codes fall back to the server's own message.
import type { Params } from './core';

type Tr = (key: string, params?: Params) => string;

const KNOWN_CODES = new Set([
  'BOOKING_EXPIRED', 'NOT_PENDING', 'NOT_CONFIRMED', 'GRACE_PERIOD', 'OUTSIDE_HOURS', 'TOO_EARLY', 'SLOT_PASSED',
  'PENDING_APPROVAL', 'NOT_ACTIVE', 'NOT_CANCELLABLE', 'NOT_YOUR_PUMP', 'BOOKINGS_OUTSIDE_HOURS', 'INVALID_RATING',
  'INVALID_REVIEW', 'INVALID_TAGS', 'REVIEW_TOO_LONG', 'BOOKING_REQUIRED', 'BOOKING_NOT_FOUND', 'PUMP_NOT_FOUND',
  'INVALID_DATE', 'INVALID_RANGE', 'INVALID_STATUS', 'INVALID_LIMIT', 'INVALID_OFFSET', 'INVALID_CAPACITY',
  'INVALID_COORDINATES', 'CONFLICT', 'EXPIRED',
]);

export function apiErrorMessage(err: any, tr: Tr, fallbackKey = 'common.somethingWrong'): string {
  const data = err?.response?.data;
  const code = data?.code;
  if (typeof code === 'string' && KNOWN_CODES.has(code)) return tr(`apiError.${code}`);
  if (!err?.response && (err?.message === 'Network Error' || err?.code === 'ECONNABORTED' || /Network|timeout/i.test(err?.message || ''))) {
    return tr('common.connectionError');
  }
  if (err?.response?.status >= 500) return tr('common.serverError', { status: err.response.status });
  return data?.message || data?.error || err?.message || tr(fallbackKey);
}

/** Same as apiErrorMessage but for an already-extracted response body ({ error, code }). */
export function messageFromData(data: any, tr: Tr, fallbackKey: string): string {
  const code = data?.code;
  if (typeof code === 'string' && KNOWN_CODES.has(code)) return tr(`apiError.${code}`);
  return data?.error || tr(fallbackKey);
}
