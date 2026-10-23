import React, { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import {
  describeLocationProblem,
  locationController,
  openLocationSettings,
  useDeviceLocation,
  useLocationSession,
} from '../../location';
import { LOCATION_CONFIG } from '../../location/config';
import { isValidCoord, movedMoreThan } from '../../location/geo';
import { useTheme, type Theme } from '../../theme';
import { LEAFLET_HEAD, LEAFLET_SCRIPT, MAP_BASE_CSS, MAP_USER_AGENT, cssVarsBlock, mapBootJs, mapThemeVars } from '../../components/mapKit';


// The page is built ONCE (pump only). The user's position and the route are
// pushed in afterwards, so a GPS update moves a marker instead of reloading the map.
function html(pumpLat: number, pumpLng: number, t: Theme) {
  return `<!DOCTYPE html>
<html>
<head>
  ${LEAFLET_HEAD}
  ${LEAFLET_SCRIPT}
  <style>
    ${cssVarsBlock(t)}
    ${MAP_BASE_CSS}
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var pump = [${Number(pumpLat)}, ${Number(pumpLng)}];
    ${mapBootJs({ center: [Number(pumpLat), Number(pumpLng)], zoom: 14 })}
    var pumpIcon = L.divIcon({
      html: '<div style="width:30px;height:30px;border-radius:50% 50% 50% 4px;transform:rotate(-45deg);background:var(--marker-pump);border:2px solid var(--marker-ring);box-shadow:0 2px 7px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center"><span style="width:8px;height:8px;border-radius:50%;background:var(--pin-dot)"></span></div>',
      className: '', iconSize: [30, 30], iconAnchor: [15, 30]
    });
    L.marker(pump, { icon: pumpIcon }).addTo(map).bindPopup('Pump');
    var userMarker = null, circle = null, line = null, fitted = false, userPos = null;

    function icon(live) {
      var c = live ? 'var(--marker-user)' : 'var(--marker-stale)';
      return L.divIcon({ html: '<div style="width:18px;height:18px;background:' + c + ';border-radius:50%;border:3px solid var(--marker-ring);box-shadow:0 0 0 8px ' + (live ? 'rgba(137,180,250,0.28)' : 'rgba(127,132,156,0.28)') + '"></div>', iconAnchor: [9, 9], className: '' });
    }
    function fit() {
      if (!userPos) return;
      map.fitBounds([userPos, pump], { padding: [60, 60] });
    }
    window.setUser = function(lat, lng, acc, live) {
      if (lat === null) { if (userMarker) { map.removeLayer(userMarker); userMarker = null; } if (circle) { map.removeLayer(circle); circle = null; } userPos = null; return; }
      userPos = [lat, lng];
      if (userMarker) { userMarker.setLatLng(userPos); userMarker.setIcon(icon(live)); }
      else userMarker = L.marker(userPos, { icon: icon(live), zIndexOffset: 1000 }).addTo(map).bindPopup('You');
      if (live && acc > 0) {
        if (circle) { circle.setLatLng(userPos); circle.setRadius(acc); }
        else circle = L.circle(userPos, { radius: acc, color: '#89b4fa', weight: 1, fillOpacity: 0.12, interactive: false }).addTo(map);
      } else if (circle) { map.removeLayer(circle); circle = null; }
      if (!fitted) { fitted = true; fit(); }
    };
    function routeColor() { return getComputedStyle(document.documentElement).getPropertyValue('--route').trim() || '#1e66f5'; }
    window.setRoute = function(coords, dashed) {
      if (line) { map.removeLayer(line); line = null; }
      if (!coords || !coords.length) return;
      var style = { color: routeColor(), weight: 5 };
      if (dashed) style.dashArray = '8 6';
      line = L.polyline(coords, style).addTo(map);
      fitted = true;
      map.fitBounds(line.getBounds(), { padding: [60, 60] });
    };
    post({ type: 'MAP_READY' });
  </script>
</body>
</html>`;
}

export default function NavigationMapScreen({ route, navigation }: any) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const pumpLat = Number(route.params?.lat);
  const pumpLng = Number(route.params?.lng);
  const pumpName = route.params?.pumpName || 'Pump';
  const address = route.params?.address || '';

  // Same shared location the rest of the app uses; no private GPS request here.
  useLocationSession(true);
  const dev = useDeviceLocation();
  const fix = dev.fix;

  const webRef = useRef<WebView>(null);
  const [mapReady, setMapReady] = useState(false);
  const [tilesFailed, setTilesFailed] = useState(false);
  const pageHtml = React.useMemo(() => html(pumpLat, pumpLng, t), [pumpLat, pumpLng]); // eslint-disable-line react-hooks/exhaustive-deps

  // Theme changes are pushed as CSS variables; the map is not rebuilt.
  useEffect(() => {
    if (mapReady) webRef.current?.injectJavaScript(`window.applyTheme(${JSON.stringify(mapThemeVars(t))});true;`);
  }, [t, mapReady]);

  const [routeCoords, setRouteCoords] = useState<[number, number][] | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distanceKm: number; durationMin: number } | null>(null);
  const [routeFailed, setRouteFailed] = useState(false);
  const [routing, setRouting] = useState(false);
  const routedFrom = useRef<{ lat: number; lng: number } | null>(null);
  const routeSeq = useRef(0);

  const inject = useCallback((js: string) => webRef.current?.injectJavaScript(`${js};true;`), []);

  // Marker follows the shared position.
  useEffect(() => {
    if (!mapReady) return;
    if (fix && isValidCoord(fix.lat, fix.lng)) {
      inject(`window.setUser(${fix.lat},${fix.lng},${fix.accuracy ?? 0},${dev.isFresh})`);
    } else {
      inject('window.setUser(null)');
    }
  }, [mapReady, fix?.lat, fix?.lng, fix?.accuracy, dev.isFresh, inject]);

  // Route: only from a real GPS fix, and only recomputed after real movement.
  useEffect(() => {
    if (!fix || fix.source !== 'gps' || !isValidCoord(pumpLat, pumpLng)) return;
    if (routedFrom.current && !movedMoreThan(routedFrom.current, fix, LOCATION_CONFIG.routeMoveM)) return;
    routedFrom.current = { lat: fix.lat, lng: fix.lng };

    const mySeq = ++routeSeq.current;
    const ctrl = new AbortController();
    setRouting(true);
    (async () => {
      try {
        const res = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${fix.lng},${fix.lat};${pumpLng},${pumpLat}?overview=full&geometries=geojson`,
          { signal: ctrl.signal }
        );
        const data = await res.json();
        const leg = data?.routes?.[0];
        if (mySeq !== routeSeq.current) return; // a newer position superseded this answer
        if (!leg) throw new Error('no route');
        setRouteCoords(leg.geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]));
        setRouteInfo({ distanceKm: leg.distance / 1000, durationMin: leg.duration / 60 });
        setRouteFailed(false);
      } catch {
        if (mySeq !== routeSeq.current) return;
        setRouteCoords(null);
        setRouteInfo(null);
        setRouteFailed(true);
      } finally {
        if (mySeq === routeSeq.current) setRouting(false);
      }
    })();
    return () => ctrl.abort();
  }, [fix?.lat, fix?.lng, fix?.source, pumpLat, pumpLng]);

  useEffect(() => {
    if (!mapReady) return;
    if (routeCoords) inject(`window.setRoute(${JSON.stringify(routeCoords)}, false)`);
    else if (routeFailed && fix) inject(`window.setRoute(${JSON.stringify([[fix.lat, fix.lng], [pumpLat, pumpLng]])}, true)`);
    else inject('window.setRoute(null)');
  }, [mapReady, routeCoords, routeFailed, inject]);

  const openMaps = async () => {
    const origin = fix ? `saddr=${fix.lat},${fix.lng}&` : '';
    try {
      await Linking.openURL(`https://maps.google.com/?${origin}daddr=${pumpLat},${pumpLng}`);
    } catch {
      // noop
    }
  };

  const problem = describeLocationProblem(dev);
  const noFix = !fix;

  return (
    <View style={styles.container}>
      <WebView
        ref={webRef}
        source={{ html: pageHtml }}
        style={StyleSheet.absoluteFill}
        originWhitelist={['*']}
        javaScriptEnabled
        userAgent={MAP_USER_AGENT}
        onMessage={(e) => {
          try {
            const d = JSON.parse(e.nativeEvent.data);
            if (d.type === 'MAP_READY') setMapReady(true);
            else if (d.type === 'TILES_FAILED') setTilesFailed(true);
            else if (d.type === 'TILES_LOADED') setTilesFailed(false);
          } catch {
            // ignore
          }
        }}
      />

      {routing || (noFix && !dev.error) ? (
        <View style={styles.loadingPill}>
          <ActivityIndicator size="small" color={t.colors.infoText} />
          <Text style={styles.loadingText}>{noFix ? 'Getting your location...' : 'Finding route...'}</Text>
        </View>
      ) : null}

      {tilesFailed ? (
        <View style={styles.loadingPill}>
          <Text style={styles.loadingText}>Map tiles could not be loaded.</Text>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => {
              setTilesFailed(false);
              inject('window.retryTiles()');
            }}
          >
            <Text style={{ color: t.colors.brandText, fontWeight: '800', fontSize: 12 }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.bottomCard}>
        <Text style={styles.name}>{pumpName}</Text>
        <Text style={styles.sub}>{address}</Text>
        {problem ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
            <Text style={[styles.sub, { flex: 1, color: t.colors.warningText }]}>{problem}</Text>
            <TouchableOpacity
              onPress={() => (dev.error === 'permission_blocked' ? openLocationSettings() : locationController.retry())}
            >
              <Text style={{ color: t.colors.infoText, fontWeight: '800' }}>
                {dev.error === 'permission_blocked' ? 'Settings' : 'Retry'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {routeInfo ? (
          <Text style={styles.routeMeta}>
            {routeInfo.distanceKm.toFixed(1)} km - ~{Math.round(routeInfo.durationMin)} min by road
          </Text>
        ) : routeFailed ? (
          <Text style={[styles.routeMeta, { color: t.colors.warningText }]}>
            Road route unavailable. The dashed line is a straight line, not the road distance.
          </Text>
        ) : null}
        <TouchableOpacity style={styles.btn} onPress={openMaps}>
          <Text style={styles.btnText}>Open in Maps</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnGhost} onPress={() => navigation.goBack()}>
          <Text style={styles.btnGhostText}>Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (t: Theme) => StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingPill: {
    position: 'absolute',
    top: 56,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: t.colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    shadowColor: t.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  loadingText: {
    color: t.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  bottomCard: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 18,
    backgroundColor: t.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: t.colors.border,
    padding: 12,
  },
  name: {
    color: t.colors.text,
    fontWeight: '800',
    fontSize: 16,
  },
  sub: {
    color: t.colors.textSecondary,
    marginTop: 2,
  },
  routeMeta: {
    color: t.colors.infoText,
    fontWeight: '700',
    fontSize: 13,
    marginTop: 6,
    marginBottom: 4,
  },
  btn: {
    backgroundColor: t.colors.info,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 11,
    marginTop: 10,
  },
  btnText: {
    color: t.colors.onInfo,
    fontWeight: '700',
  },
  btnGhost: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 10,
  },
  btnGhostText: {
    color: t.colors.textSecondary,
    fontWeight: '700',
  },
});
