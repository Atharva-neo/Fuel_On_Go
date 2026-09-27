import React, { useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocationStore } from '../../store/locationStore';

const QUICK_CITIES = [
  { city: 'Pune', district: 'Pune', lat: 18.5204, lng: 73.8567 },
  { city: 'Mumbai', district: 'Mumbai', lat: 19.076, lng: 72.8777 },
  { city: 'Kolhapur', district: 'Kolhapur', lat: 16.705, lng: 74.2433 },
  { city: 'Nagpur', district: 'Nagpur', lat: 21.1458, lng: 79.0882 },
  { city: 'Nashik', district: 'Nashik', lat: 19.9975, lng: 73.7898 },
];

export default function LocationSetupScreen({ navigation }: any) {
  const setLocation = useLocationStore((s) => s.setLocation);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const pickQuick = (city: (typeof QUICK_CITIES)[number]) => {
    setLocation({
      lat: city.lat,
      lng: city.lng,
      city: city.city,
      district: city.district,
      displayName: `${city.city}, Maharashtra`,
      bbox: null,
    });
    navigation.goBack();
  };

  const searchAndSet = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(`${query}, Maharashtra, India`)}&format=json&addressdetails=1&limit=1`;
      const res = await fetch(url, { headers: { 'User-Agent': 'FuelOnGoApp/1.0' } });
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        Alert.alert('Not found', 'Could not find this location.');
        return;
      }

      const item = data[0];
      const bboxRaw = item.boundingbox || ['0', '0', '0', '0'];
      setLocation({
        lat: Number(item.lat),
        lng: Number(item.lon),
        city: item.address?.city || item.address?.town || item.address?.village || query,
        district: item.address?.county || item.address?.state_district || 'Maharashtra',
        displayName: item.display_name,
        bbox: {
          south: Number(bboxRaw[0]),
          north: Number(bboxRaw[1]),
          west: Number(bboxRaw[2]),
          east: Number(bboxRaw[3]),
        },
      });

      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Failed to update location.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.title}>Choose Location</Text>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Search locality, city or district"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={searchAndSet} disabled={loading}>
          <Text style={styles.searchBtnText}>{loading ? '...' : 'Search'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.quickTitle}>Quick select</Text>
      <FlatList
        data={QUICK_CITIES}
        keyExtractor={(item) => item.city}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => pickQuick(item)}>
            <Text style={styles.rowTitle}>{item.city}</Text>
            <Text style={styles.rowSub}>{item.district}, Maharashtra</Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  searchBtn: {
    backgroundColor: '#0ea5e9',
    borderRadius: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  quickTitle: {
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
  },
  row: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  rowTitle: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 16,
  },
  rowSub: {
    color: '#64748b',
    marginTop: 2,
  },
});
