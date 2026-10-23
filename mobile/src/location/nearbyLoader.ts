// Debounced, stale-proof loader for nearby pumps. A response is applied only
// if it belongs to the most recent request, so a slow answer for an old
// location can never overwrite newer results.
export interface NearbyParams {
  lat?: number;
  lng?: number;
  bbox?: { north: number; south: number; east: number; west: number } | null;
  radius?: number;
}

export interface NearbyState<T> {
  status: 'idle' | 'loading' | 'ready' | 'error';
  pumps: T[];
}

export function createNearbyLoader<T>(opts: {
  fetchNearby: (p: NearbyParams, signal: AbortSignal) => Promise<T[]>;
  debounceMs: number;
  onState: (s: NearbyState<T>) => void;
  setTimeoutFn?: (fn: () => void, ms: number) => unknown;
  clearTimeoutFn?: (h: unknown) => void;
}) {
  const st = opts.setTimeoutFn ?? ((fn, ms) => setTimeout(fn, ms));
  const ct = opts.clearTimeoutFn ?? ((h) => clearTimeout(h as any));
  let seq = 0;
  let timer: unknown = null;
  let controller: AbortController | null = null;
  let state: NearbyState<T> = { status: 'idle', pumps: [] };
  const emit = (next: NearbyState<T>) => {
    state = next;
    opts.onState(next);
  };

  async function run(params: NearbyParams, mySeq: number) {
    controller?.abort();
    controller = new AbortController();
    try {
      const pumps = await opts.fetchNearby(params, controller.signal);
      if (mySeq !== seq) return;
      emit({ status: 'ready', pumps: Array.isArray(pumps) ? pumps : [] });
    } catch {
      if (mySeq !== seq) return;
      emit({ status: 'error', pumps: [] });
    }
  }

  return {
    /** Debounced: several calls inside the window collapse to the last one. */
    request(params: NearbyParams, immediate = false) {
      seq += 1;
      const mySeq = seq;
      if (timer != null) ct(timer);
      emit({ status: 'loading', pumps: state.pumps });
      if (immediate) {
        timer = null;
        void run(params, mySeq);
        return;
      }
      timer = st(() => {
        timer = null;
        void run(params, mySeq);
      }, opts.debounceMs);
    },
    cancel() {
      seq += 1;
      if (timer != null) ct(timer);
      timer = null;
      controller?.abort();
    },
    getState: () => state,
  };
}
