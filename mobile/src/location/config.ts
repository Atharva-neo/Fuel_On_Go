// Tunables for the shared location system. Everything time/distance related
// lives here so battery vs. freshness can be adjusted in one place.
export const LOCATION_CONFIG = {
  /** Fix older than this is not "live" (no live marker, no distances). */
  freshMs: 2 * 60 * 1000,
  /** While watching, force a one-off read if nothing arrived for this long (stationary Android/iOS). */
  heartbeatMs: 45 * 1000,
  /** Native watch tuning: balanced power, update at most every 15 s / 20 m. */
  watchTimeIntervalMs: 15 * 1000,
  watchDistanceIntervalM: 20,
  /** One-off fix timeout. */
  fixTimeoutMs: 15 * 1000,
  /** Accuracy worse than this (metres) is flagged low-accuracy. */
  lowAccuracyM: 150,
  /** Re-run reverse geocoding only after moving this far from the last geocoded point. */
  areaMoveM: 500,
  /** Refetch nearby pumps only after the centre moves this far (device mode). */
  nearbyMoveM: 250,
  /** Coalesce rapid nearby requests. */
  nearbyDebounceMs: 400,
  nearbyRadiusM: 30000,
  /** Route is recomputed only after the user moved this far. */
  routeMoveM: 100,
} as const;

export type LocationConfig = { -readonly [K in keyof typeof LOCATION_CONFIG]: number };
