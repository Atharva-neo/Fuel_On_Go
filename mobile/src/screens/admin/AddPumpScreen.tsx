import React, { useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { pumpService } from '../../services/pump.service';

function mapHtml(lat: number, lng: number) {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html, body, #map { height: 100%; width: 100%; margin: 0; }</style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map').setView([${lat}, ${lng}], 12);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(map);
  var marker = L.marker([${lat}, ${lng}]).addTo(map);

  map.on('click', function(e) {
    marker.setLatLng(e.latlng);
    window.ReactNativeWebView.postMessage(JSON.stringify({
      lat: e.latlng.lat,
      lng: e.latlng.lng
    }));
  });
</script>
</body>
</html>`;
}

export default function AddPumpScreen({ navigation }: any) {
  const [pumpName, setPumpName] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [openingTime, setOpeningTime] = useState('06:00');
  const [closingTime, setClosingTime] = useState('22:00');
  const [vehiclesPerSlot, setVehiclesPerSlot] = useState(5);
  const [cngPrice, setCngPrice] = useState('89.50');
  const [mapVisible, setMapVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const onSubmit = async () => {
    if (!pumpName.trim() || !licenseNumber.trim() || !address.trim() || !city.trim() || !district.trim() || lat == null || lng == null) {
      Alert.alert('Missing fields', 'Please fill all required fields.');
      return;
    }

    setSaving(true);
    try {
      await pumpService.registerPump({
        name: pumpName.trim(),
        license_number: licenseNumber.trim(),
        address: address.trim(),
        city: city.trim(),
        district: district.trim(),
        pin_code: pinCode.trim() || undefined,
        lat: Number(lat),
        lng: Number(lng),
        working_hours_start: openingTime,
        working_hours_end: closingTime,
        vehicles_per_slot: vehiclesPerSlot,
        cng_price_per_kg: Number(cngPrice),
      });

      Alert.alert('Success', 'Pump registered successfully.', [
        {
          text: 'OK',
          onPress: () => navigation.navigate('AdminTabs', { screen: 'AdminDashboard' }),
        },
      ]);
    } catch (error: any) {
      Alert.alert('Failed', error?.response?.data?.error || 'Could not register pump.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 28 }}>
      <Text style={styles.title}>Register Pump</Text>

      <Text style={styles.label}>Pump Name*</Text>
      <TextInput style={styles.input} value={pumpName} onChangeText={setPumpName} />

      <Text style={styles.label}>License Number*</Text>
      <TextInput style={styles.input} value={licenseNumber} onChangeText={setLicenseNumber} />

      <Text style={styles.label}>Address*</Text>
      <TextInput style={styles.input} value={address} onChangeText={setAddress} />

      <Text style={styles.label}>City*</Text>
      <TextInput style={styles.input} value={city} onChangeText={setCity} />

      <Text style={styles.label}>District*</Text>
      <TextInput style={styles.input} value={district} onChangeText={setDistrict} />

      <Text style={styles.label}>PIN Code</Text>
      <TextInput style={styles.input} value={pinCode} onChangeText={setPinCode} keyboardType="number-pad" />

      <TouchableOpacity style={styles.mapBtn} onPress={() => setMapVisible(true)}>
        <Text style={styles.mapBtnText}>Pick Location on Map</Text>
      </TouchableOpacity>
      {lat != null && lng != null ? (
        <Text style={styles.coord}>📍 Location selected: {lat.toFixed(4)}, {lng.toFixed(4)}</Text>
      ) : (
        <Text style={styles.coord}>Tap map to select location</Text>
      )}

      <View style={styles.timeRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Opening Time*</Text>
          <TextInput style={styles.input} value={openingTime} onChangeText={setOpeningTime} placeholder="06:00" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Closing Time*</Text>
          <TextInput style={styles.input} value={closingTime} onChangeText={setClosingTime} placeholder="22:00" />
        </View>
      </View>

      <Text style={styles.label}>Vehicles per slot</Text>
      <View style={styles.stepper}>
        <TouchableOpacity style={styles.stepBtn} onPress={() => setVehiclesPerSlot((v) => Math.max(1, v - 1))}>
          <Text style={styles.stepText}>-</Text>
        </TouchableOpacity>
        <Text style={styles.stepValue}>{vehiclesPerSlot}</Text>
        <TouchableOpacity style={styles.stepBtn} onPress={() => setVehiclesPerSlot((v) => v + 1)}>
          <Text style={styles.stepText}>+</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>CNG Price (?/kg)</Text>
      <TextInput style={styles.input} value={cngPrice} onChangeText={setCngPrice} keyboardType="decimal-pad" />

      <TouchableOpacity style={[styles.submitBtn, saving && styles.submitBtnDisabled]} onPress={onSubmit} disabled={saving}>
        <Text style={styles.submitText}>{saving ? 'Registering...' : 'Register Pump'}</Text>
      </TouchableOpacity>

      <Modal visible={mapVisible} animationType="slide" onRequestClose={() => setMapVisible(false)}>
        <View style={{ flex: 1 }}>
          <View style={styles.mapHeader}>
            <Text style={styles.mapHeaderTitle}>Tap map to set coordinates</Text>
            <TouchableOpacity onPress={() => setMapVisible(false)}>
              <Text style={styles.mapDone}>Confirm</Text>
            </TouchableOpacity>
          </View>
          <WebView
            source={{ html: mapHtml(lat ?? 18.5204, lng ?? 73.8567) }}
            style={{ height: 250 }}
            onMessage={(event) => {
              try {
                const payload = JSON.parse(event.nativeEvent.data);
                setLat(Number(payload.lat));
                setLng(Number(payload.lng));
              } catch {
                // noop
              }
            }}
          />
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  title: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 24,
    marginBottom: 12,
  },
  label: {
    color: '#475569',
    marginBottom: 6,
    fontSize: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 10,
  },
  mapBtn: {
    backgroundColor: '#e0f2fe',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 6,
  },
  mapBtnText: {
    color: '#0369a1',
    fontWeight: '700',
  },
  coord: {
    color: '#334155',
    marginBottom: 10,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 10,
  },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  stepValue: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 16,
  },
  submitBtn: {
    marginTop: 8,
    backgroundColor: '#0ea5e9',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 13,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 18,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  mapHeaderTitle: {
    color: '#0f172a',
    fontWeight: '700',
  },
  mapDone: {
    color: '#0284c7',
    fontWeight: '700',
  },
});
