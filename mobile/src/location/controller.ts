// Platform-independent device-location controller. The single source of truth
// for "where is the device", consumed by every screen through hooks (index.ts).
// Providers/timers/clock are injected so the whole thing is unit-testable.
import { createStore } from 'zustand/vanilla';
import { isValidCoord, movedMoreThan } from './geo.ts';
import type { Area } from './area.ts';
import { LOCATION_CONFIG, type LocationConfig } from './config.ts';

export type PermissionStatus = 'undetermined' | 'granted' | 'denied' | 'blocked';
export type LocationStatus = 'idle' | 'requesting' | 'acquiring' | 'active' | 'error';
export type LocationErrorCode =
  | 'permission_denied'
  | 'permission_blocked'
  | 'services_disabled'
  | 'timeout'
  | 'unavailable';

export interface RawFix {
  lat: number;
  lng: number;
  accuracy: number | null;
  timestamp: number; // epoch ms
}

export interface Fix extends RawFix {
  source: 'gps' | 'cached';
}

export interface AreaState {
  status: 'idle' | 'loading' | 'ready' | 'failed';
  area: Area | null;
}

export interface LocationState {
  permission: PermissionStatus;
  servicesEnabled: boolean;
  status: LocationStatus;
  error: LocationErrorCode | null;
  fix: Fix | null;
  /** true while `fix` is a live GPS reading younger than freshMs. */
  isFresh: boolean;
  lowAccuracy: boolean;
  areaState: AreaState;
}

export interface LocationProvider {
  getPermission(): Promise<{ status: PermissionStatus }>;
  requestPermission(): Promise<{ status: PermissionStatus }>;
  servicesEnabled(): Promise<boolean>;
  getLastKnown(): Promise<RawFix | null>;
  /** Rejects with an Error whose `code` is 'TIMEOUT' or 'UNAVAILABLE'. */
  getCurrent(timeoutMs: number, highAccuracy?: boolean): Promise<RawFix>;
  watch(
    opts: { timeIntervalMs: number; distanceIntervalM: number },
    onFix: (f: RawFix) => void,
    onError: (e: Error) => void
  ): Promise<{ remove(): void }>;
}

export interface LocationDeps {
  provider: LocationProvider;
  reverseGeocode: (lat: number, lng: number) => Promise<Area>;
  now?: () => number;
  setInterval?: (fn: () => void, ms: number) => unknown;
  clearInterval?: (h: unknown) => void;
  config?: Partial<LocationConfig>;
}

const initial: LocationState = {
  permission: 'undetermined',
  servicesEnabled: true,
  status: 'idle',
  error: null,
  fix: null,
  isFresh: false,
  lowAccuracy: false,
  areaState: { status: 'idle', area: null },
};

export function createLocationController(deps: LocationDeps) {
  const cfg: LocationConfig = { ...LOCATION_CONFIG, ...deps.config };
  const now = deps.now ?? Date.now;
  const setIntervalFn = deps.setInterval ?? ((fn, ms) => setInterval(fn, ms));
  const clearIntervalFn = deps.clearInterval ?? ((h) => clearInterval(h as any));
  const store = createStore<LocationState>(() => ({ ...initial }));
  const set = store.setState;
  const get = store.getState;

  let refCount = 0;
  let appActive = true;
  let runId = 0; // bumped on every (re)start/stop so late async results are ignored
  let subscription: { remove(): void } | null = null;
  let heartbeat: unknown = null;
  let areaAnchor: { lat: number; lng: number } | null = null;
  let areaRun = 0;

  const isLive = (f: Fix | null) => !!f && f.source === 'gps' && now() - f.timestamp <= cfg.freshMs;

  function publish(raw: RawFix, source: Fix['source']) {
    if (!isValidCoord(raw.lat, raw.lng)) return;
    const prev = get().fix;
    // Never let an older reading overwrite a newer one.
    if (prev && raw.timestamp < prev.timestamp) return;
    const fix: Fix = { ...raw, source };
    set({
      fix,
      isFresh: isLive(fix),
      lowAccuracy: fix.accuracy != null && fix.accuracy > cfg.lowAccuracyM,
      status: source === 'gps' ? 'active' : get().status,
      error: source === 'gps' ? null : get().error,
    });
    if (source === 'gps') maybeResolveArea(fix);
  }

  function setError(code: LocationErrorCode) {
    set({ error: code, status: 'error', isFresh: isLive(get().fix) });
  }

  // ─── area (reverse geocode) ──────────────────────────────
  function maybeResolveArea(fix: Fix, force = false) {
    const st = get().areaState;
    if (st.status === 'loading') return;
    if (!force && st.status !== 'failed' && st.area && !movedMoreThan(areaAnchor, fix, cfg.areaMoveM)) return;
    // After a failure, don't hammer the geocoder on every tiny fix; wait for a real move or an explicit retry.
    if (!force && st.status === 'failed' && !movedMoreThan(areaAnchor, fix, cfg.areaMoveM)) return;
    const run = ++areaRun;
    areaAnchor = { lat: fix.lat, lng: fix.lng };
    set({ areaState: { status: 'loading', area: st.area } });
    deps
      .reverseGeocode(fix.lat, fix.lng)
      .then((area) => {
        if (run !== areaRun) return;
        set({ areaState: { status: 'ready', area } });
      })
      .catch(() => {
        if (run !== areaRun) return;
        set({ areaState: { status: 'failed', area: get().areaState.area } });
      });
  }

  // ─── lifecycle ───────────────────────────────────────────
  function stopWatching() {
    runId += 1;
    subscription?.remove();
    subscription = null;
    if (heartbeat != null) clearIntervalFn(heartbeat);
    heartbeat = null;
  }

  async function ensurePermission(run: number, allowPrompt: boolean): Promise<boolean> {
    let { status } = await deps.provider.getPermission();
    if (run !== runId) return false;
    if (status === 'undetermined' && allowPrompt) {
      set({ status: 'requesting' });
      status = (await deps.provider.requestPermission()).status;
      if (run !== runId) return false;
    }
    set({ permission: status });
    if (status === 'granted') return true;
    if (status === 'blocked') setError('permission_blocked');
    else if (status === 'denied') setError('permission_denied');
    else set({ status: 'idle' });
    return false;
  }

  async function start(allowPrompt: boolean) {
    stopWatching();
    const run = runId;
    if (!appActive || refCount === 0) return;
    set({ status: 'acquiring', error: null, isFresh: isLive(get().fix) });

    try {
      if (!(await ensurePermission(run, allowPrompt))) return;

      const enabled = await deps.provider.servicesEnabled();
      if (run !== runId) return;
      set({ servicesEnabled: enabled });
      if (!enabled) return setError('services_disabled');

      // Provisional cached position: shown, but never marked live.
      if (!get().fix) {
        const cached = await deps.provider.getLastKnown().catch(() => null);
        if (run !== runId) return;
        if (cached) publish(cached, 'cached');
      }

      // Subscribe first so a slow first fix does not delay updates.
      subscription = await deps.provider.watch(
        { timeIntervalMs: cfg.watchTimeIntervalMs, distanceIntervalM: cfg.watchDistanceIntervalM },
        (f) => run === runId && publish(f, 'gps'),
        () => run === runId && void recheck()
      );
      if (run !== runId) {
        subscription.remove();
        subscription = null;
        return;
      }

      heartbeat = setIntervalFn(() => void tick(run), cfg.heartbeatMs);

      const first = await deps.provider.getCurrent(cfg.fixTimeoutMs);
      if (run !== runId) return;
      publish(first, 'gps');
    } catch (e: any) {
      if (run !== runId) return;
      if (get().fix?.source === 'gps' && isLive(get().fix)) return; // the watch already delivered one
      setError(e?.code === 'TIMEOUT' ? 'timeout' : 'unavailable');
    }
  }

  async function tick(run: number) {
    if (run !== runId) return;
    const f = get().fix;
    // Keep isFresh honest as time passes.
    if (get().isFresh !== isLive(f)) set({ isFresh: isLive(f) });
    if (f && f.source === 'gps' && now() - f.timestamp < cfg.heartbeatMs) return;
    try {
      const fx = await deps.provider.getCurrent(cfg.fixTimeoutMs);
      if (run !== runId) return;
      publish(fx, 'gps');
    } catch (e: any) {
      if (run !== runId) return;
      set({ isFresh: isLive(get().fix) });
      if (!isLive(get().fix)) setError(e?.code === 'TIMEOUT' ? 'timeout' : 'unavailable');
    }
  }

  // Permission may have been revoked / services toggled while running.
  async function recheck() {
    if (refCount === 0 || !appActive) return;
    const { status } = await deps.provider.getPermission();
    if (status !== 'granted') {
      stopWatching();
      set({ permission: status, isFresh: false });
      return setError(status === 'blocked' ? 'permission_blocked' : 'permission_denied');
    }
    if (!(await deps.provider.servicesEnabled())) {
      stopWatching();
      set({ servicesEnabled: false, isFresh: false });
      return setError('services_disabled');
    }
  }

  const api = {
    store,
    config: cfg,

    /** A screen needs location. The first caller starts GPS; later callers share it. */
    acquire(): () => void {
      refCount += 1;
      if (refCount === 1) void start(true);
      let released = false;
      return () => {
        if (released) return;
        released = true;
        api.release();
      };
    },

    release() {
      refCount = Math.max(0, refCount - 1);
      if (refCount === 0) {
        stopWatching();
        set({ status: 'idle' });
      }
    },

    /** App moved to background / foreground. */
    setAppActive(active: boolean) {
      if (active === appActive) return;
      appActive = active;
      if (!active) {
        stopWatching();
      } else if (refCount > 0) {
        void start(false); // also re-reads permission (e.g. after the system settings screen)
      }
    },

    /** User tapped retry / returned from settings. */
    retry() {
      if (refCount > 0) void start(true);
    },

    retryArea() {
      const f = get().fix;
      if (f && f.source === 'gps') maybeResolveArea(f, true);
    },

    refCount: () => refCount,
    reset() {
      stopWatching();
      refCount = 0;
      areaAnchor = null;
      areaRun += 1;
      set({ ...initial });
    },
  };
  return api;
}

export type LocationController = ReturnType<typeof createLocationController>;
