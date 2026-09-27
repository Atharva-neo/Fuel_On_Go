import React from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocationStore } from '../../store/locationStore';

function html(userLat: number, userLng: number, pumpLat: number, pumpLng: number) {
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
    var points = [[${userLat}, ${userLng}], [${pumpLat}, ${pumpLng}]];
    L.marker(points[0]).addTo(map).bindPopup('You');
    L.marker(points[1]).addTo(map).bindPopup('Pump');
    L.polyline(points, { color: '#0ea5e9', weight: 5 }).addTo(map);
    map.fitBounds(points, { padding: [20, 20] });
  </script>
</body>
</html>`;
}

export default function NavigationMapScreen({ route, navigation }: any) {
  const { lat: userLat, lng: userLng } = useLocationStore();
  const pumpLat = route.params?.lat;
  const pumpLng = route.params?.lng;
  const pumpName = route.params?.pumpName || 'Pump';
  const address = route.params?.address || '';

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
      <WebView source={{ html: html(userLat, userLng, pumpLat, pumpLng) }} style={StyleSheet.absoluteFill} />

      <View style={styles.bottomCard}>
        <Text style={styles.name}>{pumpName}</Text>
        <Text style={styles.sub}>{address}</Text>
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
    marginBottom: 10,
  },
  btn: {
    backgroundColor: '#0ea5e9',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 11,
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
