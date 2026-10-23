// Input rules for pump ratings. Pure, shared by the API and its tests.
const RATING_TAGS = [
  'fast_service',
  'short_wait',
  'clean_facility',
  'helpful_staff',
  'fair_pricing',
  'long_wait',
  'poor_service',
];
const MAX_REVIEW_CHARS = 1000;
const MAX_TAGS = 5;
const MAX_REPORT_CHARS = 500;
const MIN_REPORT_CHARS = 5;
const EDIT_WINDOW_DAYS = 7; // mirrors submit_pump_rating() in migration 008

class RatingError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

// Strip control / zero-width / bidi-override characters, collapse whitespace runs.
function cleanText(value, max) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new RatingError(400, 'INVALID_REVIEW', 'Review must be text');
  const cleaned = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁠﻿]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if ([...cleaned].length > max) {
    throw new RatingError(400, 'REVIEW_TOO_LONG', `Review must be at most ${max} characters`);
  }
  return cleaned === '' ? null : cleaned;
}

function validateSubmission(body = {}) {
  const { booking_id: bookingId, rating, review, tags } = body;
  if (typeof bookingId !== 'string' || !/^[0-9a-fA-F-]{32,40}$/.test(bookingId)) {
    throw new RatingError(400, 'BOOKING_REQUIRED', 'booking_id is required');
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new RatingError(400, 'INVALID_RATING', 'Rating must be a whole number from 1 to 5');
  }
  const cleanReview = cleanText(review, MAX_REVIEW_CHARS);

  let cleanTags = [];
  if (tags !== undefined && tags !== null) {
    if (!Array.isArray(tags)) throw new RatingError(400, 'INVALID_TAGS', 'tags must be a list');
    cleanTags = [...new Set(tags)];
    if (cleanTags.some((t) => !RATING_TAGS.includes(t))) {
      throw new RatingError(400, 'INVALID_TAGS', 'Unknown feedback tag');
    }
    if (cleanTags.length > MAX_TAGS) throw new RatingError(400, 'INVALID_TAGS', `At most ${MAX_TAGS} tags`);
    cleanTags.sort(); // stable order so an identical retry is recognised as identical
  }
  return { bookingId, rating, review: cleanReview, tags: cleanTags };
}

function validateReportReason(reason) {
  const text = cleanText(reason, MAX_REPORT_CHARS);
  if (!text || [...text].length < MIN_REPORT_CHARS) {
    throw new RatingError(400, 'REASON_REQUIRED', `Explain the problem in at least ${MIN_REPORT_CHARS} characters`);
  }
  return text;
}

// Reviewer shown as first name only: no phone, vehicle or full name leaves the server.
function displayName(fullName) {
  const first = String(fullName || '').trim().split(/\s+/)[0];
  return first ? first.slice(0, 20) : 'Customer';
}

module.exports = {
  RATING_TAGS,
  MAX_REVIEW_CHARS,
  EDIT_WINDOW_DAYS,
  RatingError,
  cleanText,
  validateSubmission,
  validateReportReason,
  displayName,
};
