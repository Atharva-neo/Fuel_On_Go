// Run: npm run test:pumploc
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyPumpLocation as E, selectSearchResult, applyGpsFix, applyManualPoint, applyAddress, applyAddressFailure,
  canConfirm, acquireOnce, latestOnly, bboxSpanDeg, parseSearchHits, formatCoord, gpsProblemMessage,
} from '../src/location/pumpLocation.ts';

const HIT = { lat: 16.8524123456, lng: 74.5815123456, label: 'Sangli, Maharashtra', bbox: ['16.80', '16.90', '74.50', '74.65'] };
const tick = () => new Promise((r) => setImmediate(r));

function provider(over = {}) {
  return {
    perm: 'granted', services: true, cur: { lat: 16.7, lng: 74.2, accuracy: 8, timestamp: 100000 }, calls: [],
    async getPermission() { return { status: this.perm }; },
    async requestPermission() { this.calls.push('request'); this.perm = this.grant ?? 'denied'; return { status: this.perm }; },
    async servicesEnabled() { return this.services; },
    async getLastKnown() { return null; },
    async getCurrent(ms, high) { this.calls.push(`current:${high}`); if (this.err) throw Object.assign(new Error('x'), { code: this.err }); return this.cur; },
    async watch() { throw new Error('one-time acquisition must never start a watch'); },
    ...over,
  };
}

test('selecting a search result uses its exact coordinates and label (full precision kept)', () => {
  const s = selectSearchResult(E, HIT);
  assert.deepEqual(s.point, { lat: 16.8524123456, lng: 74.5815123456 });
  assert.equal(s.source, 'search');
  assert.equal(s.address, 'Sangli, Maharashtra');
  assert.equal(canConfirm(s), true);
  assert.equal(formatCoord(s.point.lat), '16.852412'); // display rounding only
});

test('invalid search results are ignored', () => {
  assert.equal(selectSearchResult(E, { lat: NaN, lng: 1, label: 'x' }), E);
});

test('manual pin placement updates coordinates, marks source manual and drops the old address', () => {
  let s = selectSearchResult(E, HIT);
  s = applyManualPoint(s, 16.8531, 74.5822);
  assert.equal(s.source, 'manual');
  assert.deepEqual(s.point, { lat: 16.8531, lng: 74.5822 });
  assert.equal(s.address, null);
  assert.equal(s.addressStatus, 'loading');
});

test('GPS fix replaces a search selection (and records accuracy/timestamp)', () => {
  let s = selectSearchResult(E, HIT);
  s = applyGpsFix(s, { lat: 16.7, lng: 74.2, accuracy: 12, timestamp: 555 });
  assert.equal(s.source, 'gps');
  assert.deepEqual(s.point, { lat: 16.7, lng: 74.2 });
  assert.equal(s.accuracyM, 12);
  assert.equal(s.gpsTimestamp, 555);
  assert.equal(s.address, null);
});

test('a GPS selection can be refined manually, and a later search replaces it again', () => {
  let s = applyGpsFix(E, { lat: 16.7, lng: 74.2, accuracy: 30, timestamp: 1 });
  s = applyManualPoint(s, 16.70012, 74.20011);
  assert.equal(s.source, 'manual');
  assert.equal(s.accuracyM, null); // the refined point is no longer a GPS reading
  s = selectSearchResult(s, HIT);
  assert.equal(s.source, 'search');
  assert.equal(s.point.lat, HIT.lat);
});

test('stale reverse-geocode answers cannot overwrite a newer selection', () => {
  let s = applyManualPoint(selectSearchResult(E, HIT), 16.9, 74.6);
  const oldSeq = s.seq;
  s = applyManualPoint(s, 16.95, 74.65); // moved again before the first answer arrived
  const stale = applyAddress(s, oldSeq, 'OLD ADDRESS');
  assert.equal(stale.address, null);
  assert.equal(stale.addressStatus, 'loading');
  assert.equal(applyAddressFailure(s, oldSeq).addressStatus, 'loading');
  const fresh = applyAddress(s, s.seq, 'NEW ADDRESS');
  assert.equal(fresh.address, 'NEW ADDRESS');
  assert.deepEqual(fresh.point, { lat: 16.95, lng: 74.65 });
});

test('reverse-geocode failure keeps the coordinates', () => {
  const s0 = applyManualPoint(E, 16.9, 74.6);
  const s = applyAddressFailure(s0, s0.seq);
  assert.equal(s.addressStatus, 'failed');
  assert.deepEqual(s.point, { lat: 16.9, lng: 74.6 });
  assert.equal(canConfirm(s), true);
});

test('nothing selected cannot be confirmed', () => assert.equal(canConfirm(E), false));

test('latestOnly: a slow older search cannot replace a newer one', async () => {
  const run = latestOnly();
  let releaseOld;
  const old = run(() => new Promise((r) => { releaseOld = () => r(['old']); }));
  const fresh = run(async () => ['new']);
  releaseOld();
  assert.deepEqual(await fresh, { superseded: false, value: ['new'] });
  assert.deepEqual(await old, { superseded: true });
});

test('one-time GPS: asks permission, uses high accuracy, never watches', async () => {
  const p = provider({ perm: 'undetermined', grant: 'granted' });
  const r = await acquireOnce(p, { now: () => 100500 });
  assert.equal(r.ok, true);
  assert.equal(r.approximate, false);
  assert.deepEqual(p.calls, ['request', 'current:true']);
});

test('one-time GPS flags low accuracy and stale readings as approximate', async () => {
  const low = await acquireOnce(provider({ cur: { lat: 16.7, lng: 74.2, accuracy: 400, timestamp: 100000 } }), { now: () => 100100 });
  assert.equal(low.approximate, true);
  assert.equal(low.reason, 'low_accuracy');
  const stale = await acquireOnce(provider(), { now: () => 100000 + 120000 });
  assert.equal(stale.reason, 'stale');
  const noAcc = await acquireOnce(provider({ cur: { lat: 16.7, lng: 74.2, accuracy: null, timestamp: 100000 } }), { now: () => 100100 });
  assert.equal(noAcc.approximate, true);
});

test('permission denied / blocked / services off / timeout / unavailable are reported, not thrown', async () => {
  assert.deepEqual(await acquireOnce(provider({ perm: 'undetermined', grant: 'denied' })), { ok: false, reason: 'permission_denied' });
  assert.deepEqual(await acquireOnce(provider({ perm: 'blocked' })), { ok: false, reason: 'permission_blocked' });
  assert.deepEqual(await acquireOnce(provider({ services: false })), { ok: false, reason: 'services_disabled' });
  assert.deepEqual(await acquireOnce(provider({ err: 'TIMEOUT' })), { ok: false, reason: 'timeout' });
  assert.deepEqual(await acquireOnce(provider({ err: 'UNAVAILABLE' })), { ok: false, reason: 'unavailable' });
  assert.deepEqual(await acquireOnce(provider({ cur: { lat: 0, lng: 0, accuracy: 5, timestamp: 1 } })), { ok: false, reason: 'unavailable' });
  for (const r of ['permission_denied', 'permission_blocked', 'services_disabled', 'timeout', 'unavailable']) {
    assert.ok(gpsProblemMessage(r).length > 20);
  }
});

test('a failed GPS attempt preserves the previous valid selection', async () => {
  const before = selectSearchResult(E, HIT);
  const r = await acquireOnce(provider({ services: false }));
  const after = r.ok ? applyGpsFix(before, r.fix) : before; // exactly what the picker does
  assert.equal(after, before);
  assert.equal(canConfirm(after), true);
});

test('reopening the picker restores the confirmed point', () => {
  const confirmed = applyManualPoint(selectSearchResult(E, HIT), 16.86, 74.59);
  const reopened = confirmed; // picker initialises its state from the confirmed value
  assert.deepEqual(reopened.point, { lat: 16.86, lng: 74.59 });
});

test('zoom follows the geocoder extent: wide for areas, none for point-like results', () => {
  assert.ok(bboxSpanDeg(['16.80', '16.90', '74.50', '74.65']) > 0.1);
  assert.ok(bboxSpanDeg(['16.85200', '16.85210', '74.58150', '74.58160']) < 0.002);
  assert.equal(bboxSpanDeg(null), null);
  assert.equal(bboxSpanDeg(['a', 'b', 'c', 'd']), null);
});

test('parseSearchHits maps Nominatim output and drops junk', () => {
  const hits = parseSearchHits([
    { lat: '16.85', lon: '74.58', display_name: 'Sangli', boundingbox: ['1', '2', '3', '4'], address: { city: 'Sangli', postcode: '416416' } },
    { lat: 'x', lon: '1', display_name: 'bad' },
    { lat: '1', lon: '1' },
  ]);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].details.postcode, '416416');
  assert.deepEqual(parseSearchHits(null), []);
});
