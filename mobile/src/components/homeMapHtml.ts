import type { Theme } from '../theme/tokens.ts';
import { LEAFLET_HEAD, LEAFLET_SCRIPT, MAP_BASE_CSS, cssVarsBlock, mapBootJs } from './mapKit.ts';

export function homeMapHtml(t: Theme) {
  return `<!DOCTYPE html>
<html>
<head>
  ${LEAFLET_HEAD}
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css" />
  ${LEAFLET_SCRIPT}
  <script src="https://unpkg.com/leaflet.markercluster@1.4.1/dist/leaflet.markercluster.js"></script>
  <style>
    ${cssVarsBlock(t)}
    ${MAP_BASE_CSS}
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    ${mapBootJs({ center: [20.5937, 78.9629], zoom: 5 })}

    var userMarker = null;

    var clusterGroup = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 40,
      iconCreateFunction: function(cluster) {
        var count = cluster.getChildCount();
        return L.divIcon({
          html: '<div style="background:var(--marker-pump);color:var(--cluster-fg);width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;border:2px solid var(--marker-ring);box-shadow:0 2px 8px rgba(0,0,0,0.25)">' + count + '</div>',
          className: '',
          iconSize: [36, 36],
          iconAnchor: [18, 18]
        });
      }
    });

    map.addLayer(clusterGroup);

    function zoomToRegion(bbox) {
      if (!bbox || bbox.length !== 4) return;
      var south = parseFloat(bbox[0]);
      var north = parseFloat(bbox[1]);
      var west = parseFloat(bbox[2]);
      var east = parseFloat(bbox[3]);

      map.fitBounds([[south, west], [north, east]], { padding: [20, 20] });

      var latDiff = Math.abs(north - south);
      var zoom = 15;
      if (latDiff > 3) zoom = 8;
      else if (latDiff > 0.5) zoom = 12;

      setTimeout(function() {
        if (map.getZoom() < zoom) map.setZoom(zoom);
      }, 120);
    }

    var accuracyCircle = null;
    var programmatic = false;

    function userIcon(live) {
      var c = live ? 'var(--marker-user)' : 'var(--marker-stale)';
      return L.divIcon({
        html: '<div style="width:18px;height:18px;background:' + c + ';border-radius:50%;border:3px solid var(--marker-ring);box-shadow:0 0 0 8px ' + (live ? 'rgba(137,180,250,0.28)' : 'rgba(127,132,156,0.28)') + '"></div>',
        iconAnchor: [9, 9],
        className: ''
      });
    }

    // Updates the marker only. It never moves the camera: the app decides that.
    function updateUserLocation(lat, lng, accuracy, live) {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        if (userMarker) { map.removeLayer(userMarker); userMarker = null; }
        if (accuracyCircle) { map.removeLayer(accuracyCircle); accuracyCircle = null; }
        return;
      }
      if (userMarker) {
        userMarker.setLatLng([lat, lng]);
        userMarker.setIcon(userIcon(live));
      } else {
        userMarker = L.marker([lat, lng], { icon: userIcon(live), zIndexOffset: 1000 }).addTo(map);
      }
      var showCircle = live && Number.isFinite(accuracy) && accuracy > 0;
      if (showCircle) {
        if (accuracyCircle) {
          accuracyCircle.setLatLng([lat, lng]);
          accuracyCircle.setRadius(accuracy);
        } else {
          accuracyCircle = L.circle([lat, lng], { radius: accuracy, color: '#89b4fa', weight: 1, fillColor: '#89b4fa', fillOpacity: 0.12, interactive: false }).addTo(map);
        }
      } else if (accuracyCircle) {
        map.removeLayer(accuracyCircle);
        accuracyCircle = null;
      }
    }

    function centerOn(lat, lng, zoom, animate) {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      programmatic = true;
      var z = Number.isFinite(zoom) ? zoom : Math.max(map.getZoom(), 14);
      map.setView([lat, lng], z, { animate: !!animate, duration: 0.5 });
      setTimeout(function() { programmatic = false; }, 700);
    }

    // Tell the app when the *user* moves the map so it can stop following.
    function userMoved() {
      if (programmatic) return;
      post({ type: 'USER_GESTURE' });
    }
    map.on('dragstart', userMoved);
    map.on('zoomstart', userMoved);
    map.getContainer().addEventListener('touchstart', function(e) { if (e.touches && e.touches.length > 1) userMoved(); }, { passive: true });
    map.getContainer().addEventListener('wheel', userMoved, { passive: true });

    function escapeHtml(value) {
      return String(value == null ? '' : value).replace(/[&<>"']/g, function(character) {
        if (character === '&') return '&amp;';
        if (character === '<') return '&lt;';
        if (character === '>') return '&gt;';
        if (character === '"') return '&quot;';
        return '&#39;';
      });
    }

    function updatePumps(pumps, labels) {
      var lb = labels || {};
      clusterGroup.clearLayers();
      (pumps || []).forEach(function(pump) {
        var lat = Number(pump.lat);
        var lng = Number(pump.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        var icon = L.divIcon({
          html: '<div style="width:30px;height:30px;border-radius:50% 50% 50% 4px;transform:rotate(-45deg);background:var(--marker-pump);border:2px solid var(--marker-ring);box-shadow:0 2px 7px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center"><span style="width:8px;height:8px;border-radius:50%;background:var(--pin-dot)"></span></div>',
          className: '',
          iconSize: [30, 30],
          iconAnchor: [15, 30],
        });
        var marker = L.marker([lat, lng], { icon: icon });
        var details = [];
        if (Number.isFinite(Number(pump.available_slots_today))) {
          details.push(escapeHtml(pump.available_slots_today) + (lb.slotsSuffix || ' slots available'));
        }
        if (Number.isFinite(Number(pump.distance_km))) {
          details.push(escapeHtml(Number(pump.distance_km).toFixed(1)) + (lb.kmSuffix || ' km straight-line'));
        }
        marker.bindPopup(
          '<div class="pump-popup"><b>' + escapeHtml(pump.name || lb.pumpFallback || 'CNG Pump') + '</b><br/>' +
          escapeHtml(pump.address || '') +
          (details.length ? '<br/><span>' + details.join(' - ') + '</span>' : '') +
          '</div>'
        );
        marker.on('click', function() {
          post({ type: 'PUMP_TAP', pumpId: pump.id });
        });
        clusterGroup.addLayer(marker);
      });
    }

    function handleMessage(raw) {
      var d = null;
      try {
        d = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch (_e) {
        return;
      }
      if (!d) return;

      if (d.type === 'UPDATE_LOCATION') updateUserLocation(parseFloat(d.lat), parseFloat(d.lng), parseFloat(d.accuracy), !!d.live);
      if (d.type === 'CENTER') centerOn(parseFloat(d.lat), parseFloat(d.lng), parseFloat(d.zoom), !!d.animate);
      if (d.type === 'UPDATE_PUMPS') updatePumps(d.pumps || [], d.labels);
      if (d.type === 'ZOOM_REGION') zoomToRegion(d.bbox);
      if (d.type === 'THEME') window.applyTheme(d.vars);
      if (d.type === 'RETRY_TILES') window.retryTiles();
    }

    document.addEventListener('message', function(event) { handleMessage(event.data); });
    window.addEventListener('message', function(event) { handleMessage(event.data); });

    post({ type: 'MAP_READY' });
  </script>
</body>
</html>`;
}

