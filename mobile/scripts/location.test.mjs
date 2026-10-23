// Run: npm run test:location   (Node >= 22.6 strips the TS types)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocationController } from '../src/location/controller.ts';
import { createNearbyLoader } from '../src/location/nearbyLoader.ts';
import { haversineM, rankPumps, formatStraightLine, isValidCoord, movedMoreThan } from '../src/location/geo.ts';
import { parseReverse } from '../src/location/area.ts';
import * as cam from '../src/location/cameraPolicy.ts';

const tick = () => new Promise((r) => setImmediate(r));
const settle = async () => { for (let i = 0; i < 8; i++) await tick(); };

function fakeProvider(over = {}) {
  const p = {
    perm: 'granted',
    services: true,
    lastKnown: null,
    current: { lat: 16.7, lng: 74.24, accuracy: 10, timestamp: 1000 },
    currentError: null,
    watchers: [],
    watchCalls: 0,
    removed: 0,
    permChecks: 0,
    async getPermission() { p.permChecks++; return { status: p.perm }; },
    async requestPermission() { if (p.perm === 'undetermined') p.perm = p.grantOnRequest ?? 'denied'; return { status: p.perm }; },
    async servicesEnabled() { return p.services; },
    async getLastKnown() { return p.lastKnown; },
    async getCurrent() { if (p.currentError) throw Object.assign(new Error('x'), { code: p.currentError }); return p.current; },
    async watch(_o, onFix, onErr) {
      p.watchCalls++;
      const w = { onFix, onErr };
      p.watchers.push(w);
      return { remove() { p.removed++; p.watchers = p.watchers.filter((x) => x !== w); } };
    },
    emit(fix) { p.watchers.forEach((w) => w.onFix(fix)); },
    ...over,
  };
  return p;
}

function setup({ provider = fakeProvider(), geocode, clock = { t: 5000 }, config } = {}) {
  const geocodeCalls = [];
  const ctl = createLocationController({
    provider,
    reverseGeocode: geocode ?? (async (lat, lng) => { geocodeCalls.push([lat, lng]); return { name: 'Vishrambag', city: 'Sangli', district: 'Sangli', displayName: 'Vishrambag, Sangli' }; }),
    now: () => clock.t,
    setInterval: () => 1, // heartbeat driven manually in tests
    clearInterval: () => {},
    config,
  });
  return { ctl, provider, clock, geocodeCalls, state: () => ctl.store.getState() };
}

test('opening a location screen starts acquisition without any Navigate action', async () => {
  const { ctl, provider, state } = setup();
  ctl.acquire();
  await settle();
  assert.equal(state().permission, 'granted');
  assert.equal(state().status, 'active');
  assert.equal(provider.watchCalls, 1);
});

test('first GPS fix lands in shared state with accuracy, timestamp, freshness', async () => {
  const { ctl, state } = setup();
  ctl.acquire();
  await settle();
  const f = state().fix;
  assert.deepEqual([f.lat, f.lng, f.accuracy, f.timestamp, f.source], [16.7, 74.24, 10, 1000, 'gps']);
  assert.equal(state().isFresh, true);
});

test('a new GPS fix replaces the shared position (marker source) and an older one cannot', async () => {
  const { ctl, provider, state } = setup();
  ctl.acquire();
  await settle();
  provider.emit({ lat: 16.71, lng: 74.25, accuracy: 8, timestamp: 2000 });
  assert.equal(state().fix.lat, 16.71);
  provider.emit({ lat: 1, lng: 1, accuracy: 8, timestamp: 1500 }); // out-of-order, older
  assert.equal(state().fix.lat, 16.71);
});

test('invalid coordinates are ignored', async () => {
  const { ctl, provider, state } = setup();
  ctl.acquire();
  await settle();
  provider.emit({ lat: NaN, lng: 74, accuracy: 5, timestamp: 3000 });
  provider.emit({ lat: 0, lng: 0, accuracy: 5, timestamp: 3001 });
  assert.equal(state().fix.lat, 16.7);
});

test('cached position is provisional: shown, never marked fresh', async () => {
  const provider = fakeProvider({ lastKnown: { lat: 18, lng: 73, accuracy: 500, timestamp: 100 } });
  let release;
  provider.getCurrent = () => new Promise((r) => { release = r; }); // GPS fix is slow
  const { ctl, state } = setup({ provider });
  ctl.acquire();
  await settle();
  assert.equal(state().fix.source, 'cached');
  assert.equal(state().isFresh, false);
  release({ lat: 16.7, lng: 74.24, accuracy: 10, timestamp: 5000 });
  await settle();
  assert.equal(state().fix.source, 'gps');
  assert.equal(state().isFresh, true);
});

test('a fix that ages past freshMs is reported stale, not live', async () => {
  const { ctl, provider, clock, state } = setup({ config: { freshMs: 60000, heartbeatMs: 10 } });
  provider.currentError = null;
  ctl.acquire();
  await settle();
  assert.equal(state().isFresh, true);
  clock.t = 5000 + 61000;
  provider.getCurrent = async () => { throw Object.assign(new Error('x'), { code: 'TIMEOUT' }); };
  // drive heartbeat by emitting nothing and asking for a retry
  ctl.retry();
  await settle();
  assert.equal(state().isFresh, false);
});

test('permission denied does not crash and is reported honestly', async () => {
  const provider = fakeProvider({ perm: 'undetermined', grantOnRequest: 'denied' });
  const { ctl, state } = setup({ provider });
  ctl.acquire();
  await settle();
  assert.equal(state().error, 'permission_denied');
  assert.equal(state().fix, null);
  assert.equal(provider.watchCalls, 0);
});

test('permanently denied maps to blocked (needs system settings)', async () => {
  const { ctl, state } = setup({ provider: fakeProvider({ perm: 'blocked' }) });
  ctl.acquire();
  await settle();
  assert.equal(state().error, 'permission_blocked');
});

test('device location services disabled is handled', async () => {
  const { ctl, state } = setup({ provider: fakeProvider({ services: false }) });
  ctl.acquire();
  await settle();
  assert.equal(state().error, 'services_disabled');
  assert.equal(state().servicesEnabled, false);
});

test('GPS timeout surfaces as a timeout error without losing the app', async () => {
  const { ctl, state } = setup({ provider: fakeProvider({ currentError: 'TIMEOUT' }) });
  ctl.acquire();
  await settle();
  assert.equal(state().error, 'timeout');
});

test('low-accuracy fix is flagged', async () => {
  const provider = fakeProvider({ current: { lat: 16.7, lng: 74.2, accuracy: 900, timestamp: 1000 } });
  const { ctl, state } = setup({ provider });
  ctl.acquire();
  await settle();
  assert.equal(state().lowAccuracy, true);
});

test('repeated screen mounts share ONE native subscription', async () => {
  const { ctl, provider } = setup();
  const releases = [ctl.acquire(), ctl.acquire(), ctl.acquire()];
  await settle();
  assert.equal(provider.watchCalls, 1);
  assert.equal(ctl.refCount(), 3);
  releases[0](); releases[0](); // double release is a no-op
  releases[1]();
  assert.equal(provider.removed, 0);
  releases[2]();
  assert.equal(provider.removed, 1);
  assert.equal(provider.watchers.length, 0);
});

test('background stops GPS, foreground restarts it and re-reads permission', async () => {
  const { ctl, provider, state } = setup();
  ctl.acquire();
  await settle();
  const checks = provider.permChecks;
  ctl.setAppActive(false);
  assert.equal(provider.watchers.length, 0);
  ctl.setAppActive(true);
  await settle();
  assert.equal(provider.watchers.length, 1);
  assert.ok(provider.permChecks > checks);
  assert.equal(state().status, 'active');
});

test('returning from settings with permission granted recovers', async () => {
  const provider = fakeProvider({ perm: 'blocked' });
  const { ctl, state } = setup({ provider });
  ctl.acquire();
  await settle();
  assert.equal(state().error, 'permission_blocked');
  provider.perm = 'granted';
  ctl.setAppActive(false);
  ctl.setAppActive(true);
  await settle();
  assert.equal(state().error, null);
  assert.equal(state().status, 'active');
});

test('permission revoked while running is detected on watch error', async () => {
  const { ctl, provider, state } = setup();
  ctl.acquire();
  await settle();
  provider.perm = 'blocked';
  provider.watchers[0].onErr(new Error('revoked'));
  await settle();
  assert.equal(state().error, 'permission_blocked');
  assert.equal(provider.watchers.length, 0);
});

test('late results from a superseded start are ignored', async () => {
  const provider = fakeProvider();
  let release;
  provider.getCurrent = () => new Promise((r) => { release = r; });
  const { ctl, state } = setup({ provider });
  const off = ctl.acquire();
  await settle();
  off(); // screen left before the first fix arrived
  release({ lat: 5, lng: 5, accuracy: 1, timestamp: 9999 });
  await settle();
  assert.equal(state().fix, null);
});

// ─── reverse geocoding ───────────────────────────────────
test('reverse geocoding sets the locality, and not on every small move', async () => {
  const { ctl, provider, geocodeCalls, state } = setup();
  ctl.acquire();
  await settle();
  assert.equal(state().areaState.status, 'ready');
  assert.equal(state().areaState.area.name, 'Vishrambag');
  provider.emit({ lat: 16.7003, lng: 74.2403, accuracy: 8, timestamp: 2000 }); // ~45 m
  await settle();
  assert.equal(geocodeCalls.length, 1);
  provider.emit({ lat: 16.74, lng: 74.24, accuracy: 8, timestamp: 3000 }); // ~4 km
  await settle();
  assert.equal(geocodeCalls.length, 2);
});

test('reverse-geocode failure leaves a safe fallback and can be retried', async () => {
  let fail = true;
  const { ctl, state } = setup({
    geocode: async () => { if (fail) throw new Error('offline'); return { name: 'Miraj', city: 'Miraj', district: 'Sangli', displayName: 'Miraj' }; },
  });
  ctl.acquire();
  await settle();
  assert.equal(state().areaState.status, 'failed');
  assert.equal(state().areaState.area, null); // nothing invented
  fail = false;
  ctl.retryArea();
  await settle();
  assert.equal(state().areaState.area.name, 'Miraj');
});

test('parseReverse never fabricates a locality', () => {
  assert.equal(parseReverse({ address: {} }), null);
  assert.equal(parseReverse(null), null);
  assert.equal(parseReverse({ address: { suburb: 'Vishrambag', city: 'Sangli' }, display_name: 'x' }).name, 'Vishrambag');
});

// ─── distances & ranking ─────────────────────────────────
const SANGLI = { lat: 16.8524, lng: 74.5815 };
const KOLHAPUR = { lat: 16.705, lng: 74.2433 };

test('haversine: Sangli-Kolhapur is about 39.6 km (hand-checked), lat/lng order matters', () => {
  const km = haversineM(SANGLI, KOLHAPUR) / 1000;
  assert.ok(km > 39.4 && km < 39.8, String(km));
  assert.ok(haversineM({ lat: 74.58, lng: 16.85 }, KOLHAPUR) / 1000 > 1000); // swapped args are obviously wrong
});

test('pump distances follow the user as they move, and results are sorted', () => {
  const pumps = [
    { id: 'far', lat: 17.0, lng: 74.6 },
    { id: 'near', lat: 16.86, lng: 74.58 },
    { id: 'bad', lat: NaN, lng: 74 },
  ];
  const a = rankPumps(pumps, SANGLI);
  assert.deepEqual(a.map((p) => p.id), ['near', 'far', 'bad']);
  const moved = rankPumps(pumps, { lat: 17.0, lng: 74.6 });
  assert.deepEqual(moved.map((p) => p.id), ['far', 'near', 'bad']);
  assert.ok(moved[0].distance_km < 0.01);
});

test('without a usable device position no misleading distance is shown', () => {
  const r = rankPumps([{ id: 'a', lat: 16.8, lng: 74.5, distance_km: 3.2 }], null);
  assert.equal(r[0].distance_km, undefined);
  assert.equal(formatStraightLine(undefined), '-- km');
  assert.equal(formatStraightLine(0.34), '340 m');
  assert.equal(formatStraightLine(3.26), '3.3 km');
  assert.equal(formatStraightLine(42.4), '42 km');
});

test('isValidCoord / movedMoreThan', () => {
  assert.equal(isValidCoord(16, 74), true);
  for (const [a, b] of [[null, 1], ['', 1], [91, 0], [1, 181], [0, 0], [NaN, 1]]) assert.equal(isValidCoord(a, b), false);
  assert.equal(movedMoreThan(SANGLI, SANGLI, 100), false);
  assert.equal(movedMoreThan(SANGLI, KOLHAPUR, 100), true);
  assert.equal(movedMoreThan(null, SANGLI, 100), true);
});

// ─── nearby loader ───────────────────────────────────────
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }

test('outdated nearby responses cannot replace newer results', async () => {
  const calls = [];
  const states = [];
  const loader = createNearbyLoader({
    debounceMs: 0,
    onState: (s) => states.push(s),
    fetchNearby: (p) => { const d = deferred(); calls.push({ p, d }); return d.promise; },
  });
  loader.request({ lat: 1, lng: 1 }, true);
  loader.request({ lat: 2, lng: 2 }, true);
  calls[1].d.resolve(['new']);
  await settle();
  calls[0].d.resolve(['old']); // slow, stale answer arrives last
  await settle();
  assert.deepEqual(loader.getState().pumps, ['new']);
  assert.equal(loader.getState().status, 'ready');
});

test('nearby queries use the latest coordinates and rapid requests are coalesced', async () => {
  const seen = [];
  let timers = [];
  const loader = createNearbyLoader({
    debounceMs: 400,
    onState: () => {},
    fetchNearby: async (p) => { seen.push(p); return []; },
    setTimeoutFn: (fn) => { timers.push(fn); return timers.length - 1; },
    clearTimeoutFn: (h) => { timers[h] = null; },
  });
  loader.request({ lat: 1, lng: 1 });
  loader.request({ lat: 2, lng: 2 });
  loader.request({ lat: 3, lng: 3 });
  timers.filter(Boolean).forEach((f) => f());
  await settle();
  assert.deepEqual(seen, [{ lat: 3, lng: 3 }]);
});

test('API error ends in an error state, never a permanent loading state; retry works', async () => {
  let fail = true;
  const loader = createNearbyLoader({
    debounceMs: 0,
    onState: () => {},
    fetchNearby: async () => { if (fail) throw new Error('500'); return ['ok']; },
  });
  loader.request({ lat: 1, lng: 1 }, true);
  await settle();
  assert.equal(loader.getState().status, 'error');
  fail = false;
  loader.request({ lat: 1, lng: 1 }, true);
  await settle();
  assert.equal(loader.getState().status, 'ready');
});

// ─── camera policy & manual selection ────────────────────
test('camera: centres on first fix, follows only while follow mode is on, never fights panning', () => {
  let s = cam.initialCamera;
  let r = cam.onFix(s, false);
  assert.equal(r.action, 'center-first');
  s = r.state;
  r = cam.onFix(s, false);
  assert.equal(r.action, 'follow');
  s = cam.onUserGesture(r.state); // user pans
  r = cam.onFix(s, false);
  assert.equal(r.action, 'none');
  r = cam.onRecenter(r.state); // My location button
  assert.equal(r.action, 'center-first');
  assert.equal(r.state.follow, true);
  assert.equal(cam.onFix(r.state, false).action, 'follow');
});

test('camera: GPS updates never pull the map away from a manually selected area', () => {
  const r = cam.onFix(cam.initialCamera, true);
  assert.equal(r.action, 'none');
  assert.equal(r.state.centeredOnce, false); // still gets its first centre when the user comes back
});

test('manual selection is independent of live GPS and "use my location" recovers', async () => {
  const { useLocationStore } = await import('../src/store/locationStore.ts');
  const { ctl, state } = setup();
  ctl.acquire();
  await settle();
  const gps = { ...state().fix };
  useLocationStore.getState().setLocation({ lat: 18.52, lng: 73.85, city: 'Pune' });
  assert.equal(useLocationStore.getState().mode, 'manual');
  assert.deepEqual([state().fix.lat, state().fix.lng], [gps.lat, gps.lng]); // GPS untouched
  useLocationStore.getState().followDevice();
  assert.equal(useLocationStore.getState().mode, 'device');
  assert.equal(useLocationStore.getState().lat, null); // no stale manual coords left behind
  assert.deepEqual([state().fix.lat, state().fix.lng], [gps.lat, gps.lng]);
  // a second manual pick after recovery still works
  useLocationStore.getState().setLocation({ lat: 19.07, lng: 72.87, city: 'Mumbai' });
  assert.equal(useLocationStore.getState().city, 'Mumbai');
});

test('Navigate shares the same controller: second acquire reuses the running session and position', async () => {
  const { ctl, provider, state } = setup();
  ctl.acquire(); // Home
  await settle();
  const home = { ...state().fix };
  ctl.acquire(); // Navigation screen
  await settle();
  assert.equal(provider.watchCalls, 1);
  assert.deepEqual(state().fix, home);
});
