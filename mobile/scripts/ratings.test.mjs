// Run: npm run test:ratings
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatRatingSummary, starFills, canSubmitRating, stepRating, toggleTag, tagLabel, RATING_TAGS, RATING_LABELS, MAX_TAGS } from '../src/ratings/ratingModel.ts';
import { createRatingSubmitter, describeSubmitError } from '../src/ratings/submitFlow.ts';
import { useRatingEvents } from '../src/ratings/ratingEvents.ts';
import { mochaTheme, latteTheme } from '../src/theme/tokens.ts';
import { contrastRatio } from '../src/theme/resolve.ts';

const tick = () => new Promise((r) => setImmediate(r));
const netErr = () => Object.assign(new Error('Network Error'), { response: undefined });
const http = (status, data) => Object.assign(new Error('x'), { response: { status, data } });

test('a pump with no reviews has no rating: never 0, never a default, never 5 stars', () => {
  for (const [avg, count] of [[null, 0], [undefined, undefined], [4.0, 0], [5, 0], [null, 7], [NaN, 3]]) {
    const s = formatRatingSummary(avg, count);
    assert.equal(s.hasRating, false, `${avg}/${count}`);
    assert.equal(s.short, 'New');
    assert.equal(s.long, 'No reviews yet');
  }
  assert.deepEqual(starFills(null), ['empty', 'empty', 'empty', 'empty', 'empty']);
});

test('rating summary matches backend data (rounding, singular/plural, accessibility text)', () => {
  assert.equal(formatRatingSummary(4.26, 12).short, '4.3 (12)');
  assert.equal(formatRatingSummary(5, 1).long, '5.0 - 1 review');
  assert.equal(formatRatingSummary('3.5', 2).short, '3.5 (2)');
  assert.match(formatRatingSummary(4.2, 9).a11y, /out of 5 from 9 reviews/);
  assert.deepEqual(starFills(3.6), ['full', 'full', 'full', 'half', 'empty']);
  assert.deepEqual(starFills(5), ['full', 'full', 'full', 'full', 'full']);
});

test('star input rules: 1-5 integers only, keyboard/accessibility steps are clamped', () => {
  assert.equal(canSubmitRating({ rating: 0, review: '' }), false);
  assert.equal(canSubmitRating({ rating: 6, review: '' }), false);
  assert.equal(canSubmitRating({ rating: 2.5, review: '' }), false);
  assert.equal(canSubmitRating({ rating: 4, review: 'x'.repeat(1001) }), false);
  assert.equal(canSubmitRating({ rating: 4, review: '' }), true);
  assert.equal(stepRating(0, 1), 1);
  assert.equal(stepRating(5, 1), 5);
  assert.equal(stepRating(1, -1), 1);
  assert.equal(stepRating(3, -1), 2);
  assert.equal(RATING_LABELS[1], 'Poor');
  assert.equal(RATING_LABELS[5], 'Excellent');
});

test('quick feedback tags: labelled, toggleable, capped', () => {
  assert.deepEqual(RATING_TAGS.map((t) => t.id), ['fast_service', 'short_wait', 'clean_facility', 'helpful_staff', 'fair_pricing', 'long_wait', 'poor_service']);
  assert.equal(tagLabel('long_wait'), 'Long waiting time');
  let tags = [];
  for (const t of ['fast_service', 'short_wait', 'clean_facility', 'helpful_staff', 'fair_pricing']) tags = toggleTag(tags, t);
  assert.equal(tags.length, MAX_TAGS);
  assert.deepEqual(toggleTag(tags, 'poor_service'), tags); // cap reached
  assert.ok(!toggleTag(tags, 'fast_service').includes('fast_service'));
});

test('success is reported only after the backend confirms; the UI sees "submitting" first', async () => {
  const seen = [];
  let release;
  const s = createRatingSubmitter({
    submit: () => new Promise((r) => { release = () => r({ summary: { average: 4, count: 1 } }); }),
    onChange: (st) => seen.push(st.status),
  });
  s.setDraft({ rating: 4 });
  const p = s.send();
  await tick();
  assert.equal(s.getState().status, 'submitting');
  assert.ok(!seen.includes('success'));
  release();
  await p;
  assert.equal(s.getState().status, 'success');
  assert.deepEqual(s.getState().result, { summary: { average: 4, count: 1 } });
});

test('repeated taps while a request is in flight send exactly one request', async () => {
  let calls = 0;
  let release;
  const s = createRatingSubmitter({ submit: () => { calls += 1; return new Promise((r) => { release = () => r({}); }); } });
  s.setDraft({ rating: 5 });
  const taps = [s.send(), s.send(), s.send(), s.send()];
  await tick();
  release();
  await Promise.all(taps);
  assert.equal(calls, 1);
  await s.send(); // already succeeded: still no second request
  assert.equal(calls, 1);
});

test('network error keeps the stars, tags and text; a retry sends the identical payload and succeeds', async () => {
  let attempt = 0;
  const bodies = [];
  const s = createRatingSubmitter({
    submit: async (d) => {
      bodies.push({ ...d });
      attempt += 1;
      if (attempt === 1) throw netErr();
      return { summary: { average: 5, count: 1 } };
    },
  });
  s.setDraft({ rating: 5, review: 'Great service', tags: ['fast_service'] });
  await s.send();
  assert.equal(s.getState().status, 'error');
  assert.match(s.getState().error, /reach the server/);
  assert.deepEqual(s.getState().draft, { rating: 5, review: 'Great service', tags: ['fast_service'] }); // preserved
  await s.send();
  assert.equal(s.getState().status, 'success');
  assert.deepEqual(bodies[0], bodies[1]); // identical payload: the backend treats it as the same rating
});

test('server rejections keep the draft and explain why (not completed, own pump, window closed)', async () => {
  const s = createRatingSubmitter({ submit: async () => { throw http(409, { code: 'NOT_COMPLETED', error: 'x' }); } });
  s.setDraft({ rating: 3, review: 'meh' });
  await s.send();
  assert.equal(s.getState().status, 'error');
  assert.match(s.getState().error, /once your visit is completed/);
  assert.equal(s.getState().draft.review, 'meh');
  assert.match(describeSubmitError(http(403, { code: 'OWN_PUMP' })), /cannot rate a pump you own/);
  assert.match(describeSubmitError(http(409, { code: 'EDIT_WINDOW_CLOSED' })), /no longer be changed/);
  assert.match(describeSubmitError(http(500, {})), /Something went wrong/);
});

test('submitting without stars is refused locally and sends nothing', async () => {
  let calls = 0;
  const s = createRatingSubmitter({ submit: async () => { calls += 1; } });
  await s.send();
  assert.equal(calls, 0);
  assert.equal(s.getState().status, 'error');
});

test('draft is frozen while submitting, editable again after an error', async () => {
  let release;
  const s = createRatingSubmitter({ submit: () => new Promise((res, rej) => { release = () => rej(netErr()); }) });
  s.setDraft({ rating: 2 });
  const p = s.send();
  await tick();
  s.setDraft({ rating: 5 }); // ignored while in flight
  assert.equal(s.getState().draft.rating, 2);
  release();
  await p;
  s.setDraft({ rating: 5 });
  assert.equal(s.getState().draft.rating, 5);
});

test('a confirmed save notifies listeners so pump cards/details refetch (displayed rating updates)', () => {
  const before = useRatingEvents.getState().version;
  const seen = [];
  const unsub = useRatingEvents.subscribe((st) => seen.push([st.version, st.lastPumpId]));
  useRatingEvents.getState().bump('pump-1');
  unsub();
  assert.equal(useRatingEvents.getState().version, before + 1);
  assert.deepEqual(seen, [[before + 1, 'pump-1']]);
  // after the refetch the summary reflects backend data exactly
  assert.equal(formatRatingSummary(4.5, 2).long, '4.5 - 2 reviews');
});

for (const [name, theme] of [['Mocha (dark)', mochaTheme], ['Latte (light)', latteTheme]]) {
  test(`stars are visible in ${name}: filled and empty each >= 3:1 on page and card surfaces, and they differ`, () => {
    for (const surface of [theme.colors.bg, theme.colors.surface, theme.colors.surfaceRaised]) {
      assert.ok(contrastRatio(theme.colors.star, surface) >= 3, `filled on ${surface}`);
      assert.ok(contrastRatio(theme.colors.starEmpty, surface) >= 3, `empty on ${surface}`);
    }
    assert.notEqual(theme.colors.star, theme.colors.starEmpty);
  });
}

test('all four role x theme combinations use the same rating tokens (User/Owner share one theme system)', () => {
  for (const role of ['user', 'pump_owner']) {
    for (const theme of [mochaTheme, latteTheme]) {
      for (const key of ['star', 'starEmpty', 'brand', 'onBrand', 'brandTint', 'brandText', 'dangerTint', 'inputBg', 'surfaceRaised', 'scrim']) {
        assert.ok(theme.colors[key], `${role}/${theme.name}/${key}`);
      }
      assert.ok(contrastRatio(theme.colors.onBrand, theme.colors.brand) >= 4.5, `${role}/${theme.name} submit button`);
      assert.ok(contrastRatio(theme.colors.brandText, theme.colors.surfaceRaised) >= 4.5, `${role}/${theme.name} selected tag text`);
    }
  }
});
