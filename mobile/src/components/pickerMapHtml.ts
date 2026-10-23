import type { Theme } from '../theme/tokens.ts';
import { LEAFLET_HEAD, LEAFLET_SCRIPT, MAP_BASE_CSS, cssVarsBlock, mapBootJs } from './mapKit.ts';

// One map, one fixed centre pin: the selected point is always the map centre
// once it settles. No second (draggable-marker) system.
export function pickerMapHtml(t: Theme) {
  return `<!DOCTYPE html>
<html>
<head>
${LEAFLET_HEAD}
${LEAFLET_SCRIPT}
<style>
  ${cssVarsBlock(t)}
  ${MAP_BASE_CSS}
  /* The pin lives INSIDE the map container so nothing can leak outside the map box. */
  #pin { position: absolute; left: 50%; top: 50%; width: 30px; height: 30px; z-index: 1000; pointer-events: none;
         transform: translate(-50%, -100%); }
  #pin div { width: 30px; height: 30px; border-radius: 50% 50% 50% 0; background: var(--marker-pump); border: 3px solid var(--pin-ring);
             transform: rotate(-45deg); box-shadow: 0 2px 8px rgba(0,0,0,.4); box-sizing: border-box; }
  #dot { position: absolute; left: 50%; top: 50%; width: 6px; height: 6px; margin: -3px 0 0 -3px; border-radius: 50%;
         background: var(--pin-dot); border: 1px solid var(--pin-ring); z-index: 999; pointer-events: none; box-sizing: border-box; }
</style>
</head>
<body>
<div id="map"><div id="dot"></div><div id="pin"><div></div></div></div>
<script>
  ${mapBootJs({ center: [20.5937, 78.9629], zoom: 5 })}

  var progUntil = 0;
  map.on('dragstart', function() { progUntil = 0; });
  map.on('moveend', function() {
    var c = map.getCenter();
    post({ type: 'SETTLED', lat: c.lat, lng: c.lng, zoom: map.getZoom(), programmatic: Date.now() < progUntil });
  });

  // bbox = [south, north, west, east]. Zoom comes from the geocoder's extent
  // when it has one; the pin always lands on the result point itself.
  function fly(lat, lng, bbox, zoom) {
    progUntil = Date.now() + 1200;
    var z = zoom || 17;
    if (bbox && bbox.length === 4) {
      var b = L.latLngBounds([[+bbox[0], +bbox[2]], [+bbox[1], +bbox[3]]]);
      z = Math.min(map.getBoundsZoom(b), 18);
      if (z < 3) z = 12;
    }
    map.setView([lat, lng], z, { animate: true, duration: 0.6 });
  }

  function handle(raw) {
    var d; try { d = JSON.parse(raw); } catch (e) { return; }
    if (d.type === 'FLY') fly(+d.lat, +d.lng, d.bbox, d.zoom);
    if (d.type === 'THEME') window.applyTheme(d.vars);
    if (d.type === 'RETRY_TILES') window.retryTiles();
  }
  document.addEventListener('message', function(e) { handle(e.data); });
  window.addEventListener('message', function(e) { handle(e.data); });
  post({ type: 'READY' });
</script>
</body>
</html>`;
}

