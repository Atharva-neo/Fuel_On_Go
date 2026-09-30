import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocationStore } from '../../store/locationStore';
import { getCurrentDeviceLocation } from '../../utils/location';

function html(userLat: number, userLng: number, pumpLat: number, pumpLng: number, routeCoords: [number, number][] | null) {
  const points = [[userLat, userLng], [pumpLat, pumpLng]];
  const routeJs = routeCoords
    ? `L.polyline(${JSON.stringify(routeCoords)}, { color: '#0ea5e9', weight: 5 }).addTo(map);`
    : `L.polyline(${JSON.stringify(points)}, { color: '#0ea5e9', weight: 5, dashArray: '8 6' }).addTo(map);`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>html, body, #map { width: 100%; height: 100%; margin:0; padding:0; }</style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map').setView([${pumpLat}, ${pumpLng}], 13);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(map);
    var points = ${JSON.stringify(points)};
    L.marker(points[0]).addTo(map).bindPopup('You');
    L.marker(points[1]).addTo(map).bindPopup('Pump');
    ${routeJs}
    map.fitBounds(points, { padding: [40, 40] });
  </script>
</body>
</html>`;
}

export default function NavigationMapScreen({ route, navigation }: any) {
  const { lat: storedLat, lng: storedLng } = useLocationStore();
  const pumpLat = route.params?.lat;
  const pumpLng = route.params?.lng;
  const pumpName = route.params?.pumpName || 'Pump';
  const address = route.params?.address || '';

  const [userLat, setUserLat] = useState(storedLat);
  const [userLng, setUserLng] = useState(storedLng);
  const [routeCoords, setRouteCoords] = useState<[number, number][] | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distanceKm: number; durationMin: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Get a fresh GPS fix rather than trusting whatever region the user
      // was browsing pumps in -- they may not actually be standing there.
      const live = await getCurrentDeviceLocation();
      const startLat = live?.lat ?? storedLat;
      const startLng = live?.lng ?? storedLng;
      if (cancelled) return;
      setUserLat(startLat);
      setUserLng(startLng);

      try {
        const res = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${pumpLng},${pumpLat}?overview=full&geometries=geojson`
        );
        const data = await res.json();
        const leg = data?.routes?.[0];
        if (cancelled || !leg) return;

        const coords: [number, number][] = leg.geometry.coordinates.map(
          ([lng, lat]: [number, number]) => [lat, lng]
        );
        setRouteCoords(coords);
        setRouteInfo({
          distanceKm: leg.distance / 1000,
          durationMin: leg.duration / 60,
        });
      } catch {
        // Fall back to the straight dashed line already handled by html().
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openMaps = async () => {
    const url = `https://maps.google.com/?saddr=${userLat},${userLng}&daddr=${pumpLat},${pumpLng}`;
    try {
      await Linking.openURL(url);
    } catch {
      // noop
    }
  };

  return (
    <View style={styles.container}>
      <WebView
        source={{ html: html(userLat, userLng, pumpLat, pumpLng, routeCoords) }}
        style={StyleSheet.absoluteFill}
      />

      {loading ? (
        <View style={styles.loadingPill}>
          <ActivityIndicator size="small" color="#0ea5e9" />
          <Text style={styles.loadingText}>Finding route...</Text>
        </View>
      ) : null}

      <View style={styles.bottomCard}>
        <Text style={styles.name}>{pumpName}</Text>
        <Text style={styles.sub}>{address}</Text>
        {routeInfo ? (
          <Text style={styles.routeMeta}>
            {routeInfo.distanceKm.toFixed(1)} km · ~{Math.round(routeInfo.durationMin)} min by road
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

const styles = StyleSheet.create({
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
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  loadingText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
  },
  bottomCard: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 18,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
  },
  name: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 16,
  },
  sub: {
    color: '#64748b',
    marginTop: 2,
  },
  routeMeta: {
    color: '#0ea5e9',
    fontWeight: '700',
    fontSize: 13,
    marginTop: 6,
    marginBottom: 4,
  },
  btn: {
    backgroundColor: '#0ea5e9',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 11,
    marginTop: 10,
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
  },
  btnGhost: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 10,
  },
  btnGhostText: {
    color: '#334155',
    fontWeight: '700',
  },
});
