// Shared Leaflet bootstrap for every WebView map (home, navigation, pump-location picker).
// One tile configuration, one theming mechanism, one tile-failure signal.
import type { Theme } from '../theme/tokens.ts';

// Root cause of the grey "Map data not yet available" tiles: the app used Esri's
// World_Street_Map service, which has NO imagery at zoom >= 18 for most of India
// (it answers 200 with a grey placeholder image, so no error is ever raised).
// OpenStreetMap tiles exist to zoom 19 everywhere, so they are the default.
//
// OSM's volunteer tile servers are for light use. For production traffic set
// EXPO_PUBLIC_MAP_TILE_URL (+ _ATTRIBUTION) to a provider you have a key for
// (MapTiler, Stadia, Thunderforest, a self-hosted server, ...).
export const MAP_TILES = {
  url: process.env.EXPO_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution:
    process.env.EXPO_PUBLIC_MAP_TILE_ATTRIBUTION ||
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
} as const;

// OSM blocks anonymous browser user agents (HTTP 403 "Access blocked" tile).
// Its tile policy requires an app-identifying user agent.
export const MAP_USER_AGENT = 'FuelOnGoApp/1.0 (CNG slot booking app)';

/** CSS custom properties the map page reads; re-sent on every theme change. */
export function mapThemeVars(t: Theme): Record<string, string> {
  const c = t.colors;
  return {
    '--map-bg': c.bgAlt,
    '--control-bg': c.mapControlBg,
    '--control-fg': c.mapControlIcon,
    '--control-border': c.border,
    '--popup-bg': c.mapPopupBg,
    '--popup-fg': c.text,
    '--popup-muted': c.textSecondary,
    '--attr-bg': t.isDark ? 'rgba(24,24,37,0.82)' : 'rgba(239,241,245,0.86)',
    '--attr-fg': c.textSecondary,
    '--attr-link': c.brandText,
    '--marker-pump': c.markerPump,
    '--marker-pump-ring': c.onBrand,
    '--marker-user': c.markerUser,
    '--marker-stale': c.markerStale,
    '--marker-ring': t.isDark ? c.bgAlt : '#ffffff',
    '--cluster-fg': c.onBrand,
    '--route': c.info,
    '--pin-ring': t.isDark ? c.bgAlt : '#ffffff',
    '--pin-dot': c.onBrand,
    // Standard tiles are light; in Mocha they are inverted so the map matches the UI.
    '--tile-filter': t.isDark ? 'invert(1) hue-rotate(180deg) brightness(1.12) contrast(0.88) saturate(0.55)' : 'none',
  };
}

export const MAP_BASE_CSS = `
  html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: var(--map-bg); }
  .leaflet-tile-pane { filter: var(--tile-filter); }
  .leaflet-container { background: var(--map-bg); font-family: sans-serif; }
  .leaflet-bar { border: 1px solid var(--control-border) !important; box-shadow: none !important; border-radius: 12px; overflow: hidden; }
  .leaflet-bar a, .leaflet-bar a:hover { background: var(--control-bg); color: var(--control-fg); border-bottom: 1px solid var(--control-border); width: 40px; height: 40px; line-height: 40px; font-size: 20px; }
  .leaflet-bar a:last-child { border-bottom: none; }
  .leaflet-bar a.leaflet-disabled { opacity: .45; }
  .leaflet-control-attribution { background: var(--attr-bg) !important; color: var(--attr-fg) !important; font-size: 10px; border-radius: 8px 0 0 0; }
  .leaflet-control-attribution a { color: var(--attr-link) !important; }
  .leaflet-popup-content-wrapper, .leaflet-popup-tip { background: var(--popup-bg); color: var(--popup-fg); }
  .pump-popup { color: var(--popup-fg); }
  .pump-popup span { color: var(--popup-muted); }
`;

export const LEAFLET_HEAD = `
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
`;

export const LEAFLET_SCRIPT = `<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>`;

export function cssVarsBlock(t: Theme): string {
  const vars = mapThemeVars(t);
  return `:root { ${Object.entries(vars).map(([k, v]) => `${k}: ${v};`).join(' ')} }`;
}

/**
 * Creates `map`, `post()`, the tile layer and tile-health reporting.
 * Messages posted to React Native: TILES_LOADED, TILES_FAILED.
 * Callable from RN: window.retryTiles(), window.applyTheme(vars).
 */
export function mapBootJs(opts: { center: [number, number]; zoom: number; zoomControl?: boolean }): string {
  return `
  var map = L.map('map', { zoomControl: ${opts.zoomControl === false ? 'false' : 'true'}, attributionControl: true })
    .setView([${opts.center[0]}, ${opts.center[1]}], ${opts.zoom});
  function post(o) { window.ReactNativeWebView.postMessage(JSON.stringify(o)); }

  var tileLayer = L.tileLayer(${JSON.stringify(MAP_TILES.url)}, {
    maxZoom: ${MAP_TILES.maxZoom},
    attribution: ${JSON.stringify(MAP_TILES.attribution)}
  }).addTo(map);

  var tileOk = 0, tileErr = 0, failedSent = false;
  tileLayer.on('tileload', function() { tileOk++; if (failedSent) { failedSent = false; post({ type: 'TILES_LOADED' }); } });
  tileLayer.on('load', function() { if (tileOk > 0) post({ type: 'TILES_LOADED' }); });
  tileLayer.on('tileerror', function() {
    tileErr++;
    // Several failures with nothing ever drawn = provider blocked / offline.
    if (tileOk === 0 && tileErr >= 3 && !failedSent) { failedSent = true; post({ type: 'TILES_FAILED' }); }
  });
  window.retryTiles = function() { tileErr = 0; failedSent = false; tileLayer.redraw(); };
  window.applyTheme = function(vars) {
    for (var k in vars) document.documentElement.style.setProperty(k, vars[k]);
  };
  `;
}
