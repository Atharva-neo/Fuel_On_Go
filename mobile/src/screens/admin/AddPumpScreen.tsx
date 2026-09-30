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
import { LocationIcon, ArrowLeftIcon } from '../../components/ui/Icons';

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
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeftIcon size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Register Pump</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.label}>Pump Name*</Text>
          <TextInput style={styles.input} placeholderTextColor="#6B7280" value={pumpName} onChangeText={setPumpName} />

          <Text style={styles.label}>License Number*</Text>
          <TextInput style={styles.input} placeholderTextColor="#6B7280" value={licenseNumber} onChangeText={setLicenseNumber} />

          <Text style={styles.label}>Address*</Text>
          <TextInput style={styles.input} placeholderTextColor="#6B7280" value={address} onChangeText={setAddress} />

          <Text style={styles.label}>City*</Text>
          <TextInput style={styles.input} placeholderTextColor="#6B7280" value={city} onChangeText={setCity} />

          <Text style={styles.label}>District*</Text>
          <TextInput style={styles.input} placeholderTextColor="#6B7280" value={district} onChangeText={setDistrict} />

          <Text style={styles.label}>PIN Code</Text>
          <TextInput
            style={[styles.input, { marginBottom: 0 }]}
            placeholderTextColor="#6B7280"
            value={pinCode}
            onChangeText={setPinCode}
            keyboardType="number-pad"
          />
        </View>

        <View style={styles.card}>
          <TouchableOpacity style={styles.mapBtn} onPress={() => setMapVisible(true)}>
            <Text style={styles.mapBtnText}>Pick Location on Map</Text>
          </TouchableOpacity>
          {lat != null && lng != null ? (
            <View style={styles.coordRow}>
              <LocationIcon size={12} color="#00C896" />
              <Text style={styles.coord}>Location selected: {lat.toFixed(4)}, {lng.toFixed(4)}</Text>
            </View>
          ) : (
            <Text style={styles.coordMuted}>Tap map to select location</Text>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.timeRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Opening Time*</Text>
              <TextInput style={styles.input} placeholderTextColor="#6B7280" value={openingTime} onChangeText={setOpeningTime} placeholder="06:00" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Closing Time*</Text>
              <TextInput style={styles.input} placeholderTextColor="#6B7280" value={closingTime} onChangeText={setClosingTime} placeholder="22:00" />
            </View>
          </View>

          <Text style={styles.label}>Vehicles per slot</Text>
          <View style={styles.stepper}>
            <TouchableOpacity style={styles.stepBtn} onPress={() => setVehiclesPerSlot((v) => Math.max(1, v - 1))}>
              <Text style={styles.stepText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.stepValue}>{vehiclesPerSlot}</Text>
            <TouchableOpacity style={styles.stepBtn} onPress={() => setVehiclesPerSlot((v) => v + 1)}>
              <Text style={styles.stepText}>+</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>CNG Price (₹/kg)</Text>
          <TextInput
            style={[styles.input, { marginBottom: 0 }]}
            placeholderTextColor="#6B7280"
            value={cngPrice}
            onChangeText={setCngPrice}
            keyboardType="decimal-pad"
          />
        </View>

        <TouchableOpacity style={[styles.submitBtn, saving && styles.submitBtnDisabled]} onPress={onSubmit} disabled={saving}>
          <Text style={styles.submitText}>{saving ? 'Registering...' : 'Register Pump'}</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={mapVisible} animationType="slide" onRequestClose={() => setMapVisible(false)}>
        <View style={{ flex: 1, backgroundColor: '#111827' }}>
          <View style={styles.mapHeader}>
            <Text style={styles.mapHeaderTitle}>Tap map to set coordinates</Text>
            <TouchableOpacity style={styles.mapDoneBtn} onPress={() => setMapVisible(false)}>
              <Text style={styles.mapDone}>Confirm</Text>
            </TouchableOpacity>
          </View>
          <WebView
            source={{ html: mapHtml(lat ?? 18.5204, lng ?? 73.8567) }}
            style={{ flex: 1 }}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#111827',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 22,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#1F2937',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  label: {
    color: '#9CA3AF',
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: '#111827',
    color: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 46,
    marginBottom: 16,
    fontSize: 15,
  },
  mapBtn: {
    backgroundColor: 'rgba(0,200,150,0.12)',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,200,150,0.3)',
  },
  mapBtnText: {
    color: '#00C896',
    fontWeight: '700',
  },
  coordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  coord: {
    color: '#D1D5DB',
    fontSize: 13,
  },
  coordMuted: {
    color: '#6B7280',
    fontSize: 13,
    marginTop: 12,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stepValue: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
    minWidth: 20,
    textAlign: 'center',
  },
  submitBtn: {
    backgroundColor: '#00C896',
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 4,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitText: {
    color: '#0A0A0A',
    fontWeight: '800',
    fontSize: 16,
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  mapHeaderTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
    flex: 1,
    marginRight: 12,
  },
  mapDoneBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(0,200,150,0.15)',
  },
  mapDone: {
    color: '#00C896',
    fontWeight: '700',
  },
});
