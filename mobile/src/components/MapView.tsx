import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface PumpMarker {
  id: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  available_slots_today?: number;
  distance_km?: number;
}

interface SearchRegion {
  lat: number;
  lng: number;
  bbox?: [string | number, string | number, string | number, string | number] | null;
}

interface Props {
  userLat: number;
  userLng: number;
  pumps: PumpMarker[];
  searchRegion?: SearchRegion | null;
  onPumpPress?: (pumpId: string) => void;
}

function mapHtml() {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/leaflet.markercluster@1.4.1/dist/leaflet.markercluster.js"></script>
  <style>
    html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; }
    .pump-popup { font-family: sans-serif; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: true, attributionControl: true }).setView([20.5937, 78.9629], 5);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri',
    }).addTo(map);

    var userMarker = null;

    var clusterGroup = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 40,
      iconCreateFunction: function(cluster) {
        var count = cluster.getChildCount();
        return L.divIcon({
          html: '<div style="background:#00c896;color:white;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.2)">' + count + '</div>',
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

      var bounds = [
        [south, west],
        [north, east]
      ];

      map.fitBounds(bounds, { padding: [20, 20] });

      var latDiff = Math.abs(north - south);
      var zoom = 15;
      if (latDiff > 3) zoom = 8;
      else if (latDiff > 0.5) zoom = 12;
      else zoom = 15;

      setTimeout(function() {
        if (map.getZoom() < zoom) {
          map.setZoom(zoom);
        }
      }, 120);
    }

    function updateUserLocation(lat, lng) {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      if (userMarker) {
        userMarker.setLatLng([lat, lng]);
      } else {
        var icon = L.divIcon({
          html: '<div style="width:18px;height:18px;background:#1d4ed8;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 8px rgba(29,78,216,0.2)"></div>',
          iconAnchor: [9, 9],
          className: ''
        });
        userMarker = L.marker([lat, lng], { icon: icon }).addTo(map);
      }
      map.setView([lat, lng], 12);
    }

    function updatePumps(pumps) {
      clusterGroup.clearLayers();
      (pumps || []).forEach(function(pump) {
        var lat = Number(pump.lat);
        var lng = Number(pump.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        function escapeHtml(value) {
          return String(value == null ? '' : value).replace(/[&<>"']/g, function(character) {
            if (character === '&') return '&amp;';
            if (character === '<') return '&lt;';
            if (character === '>') return '&gt;';
            if (character === '"') return '&quot;';
            return '&#39;';
          });
        }

        var icon = L.divIcon({
          html: '<div style="width:30px;height:30px;border-radius:50% 50% 50% 4px;transform:rotate(-45deg);background:#00c896;border:2px solid #fff;box-shadow:0 2px 7px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center"><span style="width:8px;height:8px;border-radius:50%;background:#fff"></span></div>',
          className: '',
          iconSize: [30, 30],
          iconAnchor: [15, 30],
        });
        var marker = L.marker([lat, lng], { icon: icon });
        var details = [];
        if (Number.isFinite(Number(pump.available_slots_today))) {
          details.push(escapeHtml(pump.available_slots_today) + ' slots available');
        }
        if (Number.isFinite(Number(pump.distance_km))) {
          details.push(escapeHtml(Number(pump.distance_km).toFixed(1)) + ' km away');
        }
        marker.bindPopup(
          '<div class="pump-popup"><b>' + escapeHtml(pump.name || 'CNG Pump') + '</b><br/>' +
          escapeHtml(pump.address || '') +
          (details.length ? '<br/><span>' + details.join(' · ') + '</span>' : '') +
          '</div>'
        );
        marker.on('click', function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'PUMP_TAP',
            pumpId: pump.id
          }));
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

      if (d.type === 'UPDATE_LOCATION') {
        updateUserLocation(parseFloat(d.lat), parseFloat(d.lng));
      }

      if (d.type === 'UPDATE_PUMPS') {
        updatePumps(d.pumps || []);
      }

      if (d.type === 'ZOOM_REGION') {
        zoomToRegion(d.bbox);
      }
    }

    document.addEventListener('message', function(event) {
      handleMessage(event.data);
    });

    window.addEventListener('message', function(event) {
      handleMessage(event.data);
    });

    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_READY' }));
  </script>
</body>
</html>`;
}

export default function MapView({ userLat, userLng, pumps, searchRegion, onPumpPress }: Props) {
  const webViewRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);

  const html = useMemo(() => mapHtml(), []);

  const post = (payload: any) => {
    if (!ready) return;
    webViewRef.current?.postMessage(JSON.stringify(payload));
  };

  useEffect(() => {
    post({ type: 'UPDATE_LOCATION', lat: userLat, lng: userLng });
  }, [userLat, userLng, ready]);

  useEffect(() => {
    post({ type: 'UPDATE_PUMPS', pumps });
  }, [pumps, ready]);

  useEffect(() => {
    if (searchRegion?.bbox) {
      post({
        type: 'ZOOM_REGION',
        bbox: searchRegion.bbox,
        lat: searchRegion.lat,
        lng: searchRegion.lng,
      });
    }
  }, [searchRegion, ready]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={styles.webview}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'MAP_READY') {
              setReady(true);
              return;
            }
            if (data.type === 'PUMP_TAP' && onPumpPress) {
              onPumpPress(data.pumpId);
            }
          } catch {
            // noop
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
