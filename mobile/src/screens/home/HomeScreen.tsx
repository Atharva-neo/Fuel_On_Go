import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView from '../../components/MapView';
import { pumpService, type Pump } from '../../services/pump.service';
import { useLocationStore, type LocationBbox } from '../../store/locationStore';
import { useAuthStore } from '../../store/authStore';

const SCREEN_H = Dimensions.get('window').height;
const SNAP_PEEK = SCREEN_H * 0.75;
const SNAP_HALF = SCREEN_H * 0.45;
const SNAP_FULL = SCREEN_H * 0.08;

type SearchResult =
  | {
      type: 'place';
      id: string;
      title: string;
      subtitle: string;
      lat: number;
      lng: number;
      city: string;
      district: string;
      bbox: [string, string, string, string];
    }
  | {
      type: 'pump';
      id: string;
      title: string;
      subtitle: string;
      pumpId: string;
    };

function formatDistance(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-- km';
  return `${value.toFixed(1)} km`;
}

function buildBbox(raw: [string, string, string, string]): LocationBbox {
  return {
    south: parseFloat(raw[0]),
    north: parseFloat(raw[1]),
    west: parseFloat(raw[2]),
    east: parseFloat(raw[3]),
  };
}

function NearbyBottomSheet({
  pumps,
  loading,
  onBook,
  onPumpTap,
}: {
  pumps: Pump[];
  loading: boolean;
  onBook: (pump: Pump) => void;
  onPumpTap: (pump: Pump) => void;
}) {
  const sheetY = useRef(new Animated.Value(SNAP_PEEK)).current;
  const currentY = useRef(SNAP_PEEK);
  const dragStartY = useRef(SNAP_PEEK);

  useEffect(() => {
    const id = sheetY.addListener(({ value }) => {
      currentY.current = value;
    });
    return () => sheetY.removeListener(id);
  }, [sheetY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => {
        return Math.abs(g.dy) > 5 && Math.abs(g.dy) > Math.abs(g.dx);
      },
      onPanResponderGrant: () => {
        dragStartY.current = currentY.current;
      },
      onPanResponderMove: (_, g) => {
        const newY = dragStartY.current + g.dy;
        if (newY >= SNAP_FULL && newY <= SNAP_PEEK) {
          sheetY.setValue(newY);
        }
      },
      onPanResponderRelease: (_, g) => {
        const pos = currentY.current;
        const vel = g.vy;
        let snapTo = SNAP_PEEK;

        if (vel < -0.5) {
          snapTo = pos < SNAP_HALF ? SNAP_FULL : SNAP_HALF;
        } else if (vel > 0.5) {
          snapTo = pos > SNAP_HALF ? SNAP_PEEK : SNAP_HALF;
        } else {
          if (pos < SCREEN_H * 0.25) snapTo = SNAP_FULL;
          else if (pos < SCREEN_H * 0.60) snapTo = SNAP_HALF;
          else snapTo = SNAP_PEEK;
        }

        Animated.spring(sheetY, {
          toValue: snapTo,
          useNativeDriver: false,
          tension: 65,
          friction: 11,
        }).start(() => {
          currentY.current = snapTo;
        });
      },
    })
  ).current;

  return (
    <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetY }] }]}>
      <View {...panResponder.panHandlers} style={styles.handleArea}>
        <View style={styles.handle} />
        <Text style={styles.sheetTitle}>{pumps.length} CNG pumps nearby</Text>
      </View>

      <ScrollView style={{ flex: 1 }} scrollEventThrottle={16} nestedScrollEnabled contentContainerStyle={{ paddingBottom: 90 }}>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 24 }} color="#0ea5e9" />
        ) : (
          pumps.map((pump) => (
            <TouchableOpacity key={pump.id} style={styles.pumpCard} onPress={() => onPumpTap(pump)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pumpName} numberOfLines={1}>
                  {pump.name}
                </Text>
                <Text style={styles.pumpAddress} numberOfLines={1}>
                  {pump.address}
                </Text>
                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>?? {formatDistance(pump.distance_km)}</Text>
                  <Text style={styles.metaText}>? ?{pump.cng_price_per_kg}/kg</Text>
                  <Text style={[styles.metaText, { color: '#0f9d58', fontWeight: '700' }]}>
                    {pump.available_slots_today ?? 0} slots
                  </Text>
                </View>
              </View>
              <TouchableOpacity style={styles.bookBtn} onPress={() => onBook(pump)}>
                <Text style={styles.bookBtnText}>Book</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </Animated.View>
  );
}

export default function HomeScreen({ navigation }: any) {
  const { lat, lng, city, displayName, bbox, setLocation } = useLocationStore();

  const [pumps, setPumps] = useState<Pump[]>([]);
  const [loadingPumps, setLoadingPumps] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedPump, setSelectedPump] = useState<Pump | null>(null);
  const [searchRegion, setSearchRegion] = useState<{
    lat: number;
    lng: number;
    bbox?: [string, string, string, string] | null;
  } | null>(bbox ? { lat, lng, bbox: [String(bbox.south), String(bbox.north), String(bbox.west), String(bbox.east)] } : null);

  const regionBbox = useMemo(() => bbox ?? null, [bbox]);

  const loadNearby = async (args?: { lat?: number; lng?: number; bbox?: LocationBbox | null }) => {
    const targetLat = args?.lat ?? lat;
    const targetLng = args?.lng ?? lng;
    const targetBbox = args?.bbox ?? regionBbox;

    setLoadingPumps(true);
    try {
      const data = await pumpService.getNearby({
        lat: targetLat,
        lng: targetLng,
        bbox: targetBbox,
        radius: 30000,
      });
      setPumps(data);
    } catch {
      setPumps([]);
    } finally {
      setLoadingPumps(false);
    }
  };

  useEffect(() => {
    loadNearby();
  }, [lat, lng, regionBbox?.north, regionBbox?.south, regionBbox?.east, regionBbox?.west]);

  useEffect(() => {
    if (!searchText.trim()) {
      setResults([]);
      return;
    }

    const id = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(`${searchText}, Maharashtra, India`)}&format=json&addressdetails=1&limit=8`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'FuelOnGoApp/1.0' },
        });
        const data = await res.json();

        const places: SearchResult[] = (Array.isArray(data) ? data : []).map((item: any) => ({
          type: 'place',
          id: String(item.place_id),
          title: item.display_name?.split(',')?.[0] ?? 'Selected place',
          subtitle: item.display_name ?? '',
          lat: Number(item.lat),
          lng: Number(item.lon),
          city:
            item.address?.city ||
            item.address?.town ||
            item.address?.village ||
            item.address?.suburb ||
            item.display_name?.split(',')?.[0] ||
            'Maharashtra',
          district: item.address?.county || item.address?.state_district || 'Maharashtra',
          bbox: item.boundingbox || ['0', '0', '0', '0'],
        }));

        const matchingPumps: SearchResult[] = pumps
          .filter((pump) => {
            const q = searchText.toLowerCase();
            return (
              pump.name.toLowerCase().includes(q) ||
              pump.city.toLowerCase().includes(q) ||
              pump.address.toLowerCase().includes(q)
            );
          })
          .slice(0, 3)
          .map((pump) => ({
            type: 'pump',
            id: `pump-${pump.id}`,
            title: pump.name,
            subtitle: pump.address,
            pumpId: pump.id,
          }));

        setResults([...matchingPumps, ...places]);
      } catch {
        setResults([]);
      }
    }, 350);

    return () => clearTimeout(id);
  }, [searchText, pumps]);

  const onResultSelect = async (result: SearchResult) => {
    if (result.type === 'pump') {
      setSearchVisible(false);
      setSearchText('');
      navigation.navigate('PumpDetail', { pumpId: result.pumpId });
      return;
    }

    const mapped = buildBbox(result.bbox);
    setLocation({
      lat: result.lat,
      lng: result.lng,
      city: result.city,
      district: result.district,
      displayName: result.subtitle,
      bbox: mapped,
    });

    setSearchRegion({
      lat: result.lat,
      lng: result.lng,
      bbox: result.bbox,
    });

    setSearchVisible(false);
    setSearchText('');
    await loadNearby({ lat: result.lat, lng: result.lng, bbox: mapped });
  };

  const onBookPump = (pump: Pump) => {
    navigation.navigate('PumpDetail', { pumpId: pump.id });
  };

  return (
    <View style={styles.root}>
      <MapView
        userLat={lat}
        userLng={lng}
        pumps={pumps}
        searchRegion={searchRegion}
        onPumpPress={(pumpId) => {
          const found = pumps.find((p) => p.id === pumpId) || null;
          setSelectedPump(found);
        }}
      />

      <View style={styles.topBar}>
        <TouchableOpacity style={styles.locationPill} onPress={() => navigation.navigate('LocationSetup')}>
          <Text style={styles.locationText}>?? {city}</Text>
          <Text style={styles.locationSub} numberOfLines={1}>
            {displayName}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.searchBtn} onPress={() => setSearchVisible(true)}>
          <Text style={styles.searchIcon}>??</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.searchBtn}
          accessibilityLabel="Log out"
          onPress={() =>
            Alert.alert('Logout', 'Are you sure you want to logout?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Logout', style: 'destructive', onPress: () => useAuthStore.getState().logout() },
            ])
          }
        >
          <Text style={styles.logoutIcon}>⎋</Text>
        </TouchableOpacity>
      </View>

      {selectedPump ? (
        <View style={styles.popup}>
          <Text style={styles.popupName}>{selectedPump.name}</Text>
          <Text style={styles.popupAddr} numberOfLines={1}>
            {selectedPump.address}
          </Text>
          <View style={styles.popupActions}>
            <TouchableOpacity style={styles.popupPrimary} onPress={() => navigation.navigate('PumpDetail', { pumpId: selectedPump.id })}>
              <Text style={styles.popupPrimaryText}>View & Book</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.popupSecondary}
              onPress={() =>
                navigation.navigate('Navigation', {
                  lat: selectedPump.lat,
                  lng: selectedPump.lng,
                  pumpName: selectedPump.name,
                  address: selectedPump.address,
                })
              }
            >
              <Text style={styles.popupSecondaryText}>Navigate</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <NearbyBottomSheet
        pumps={pumps}
        loading={loadingPumps}
        onBook={onBookPump}
        onPumpTap={(pump) => setSelectedPump(pump)}
      />

      <Modal visible={searchVisible} animationType="slide" onRequestClose={() => setSearchVisible(false)}>
        <View style={styles.searchContainer}>
          <View style={styles.searchHeader}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search city, locality or pump"
              value={searchText}
              onChangeText={setSearchText}
              autoFocus
            />
            <TouchableOpacity onPress={() => setSearchVisible(false)}>
              <Text style={styles.cancel}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.resultRow} onPress={() => onResultSelect(item)}>
                <Text style={styles.resultIcon}>{item.type === 'pump' ? '?' : '??'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultTitle}>{item.title}</Text>
                  <Text style={styles.resultSub} numberOfLines={1}>
                    {item.subtitle}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.empty}>No results</Text>}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#fff',
  },
  topBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 34,
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 20,
  },
  locationPill: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: '68%',
  },
  locationText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 14,
  },
  locationSub: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  searchBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.98)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchIcon: {
    fontSize: 18,
  },
  logoutIcon: {
    fontSize: 20,
    color: '#dc2626',
    fontWeight: '700',
  },
  popup: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: SCREEN_H * 0.28,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    zIndex: 25,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  popupName: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 15,
  },
  popupAddr: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 3,
    marginBottom: 10,
  },
  popupActions: {
    flexDirection: 'row',
    gap: 8,
  },
  popupPrimary: {
    flex: 1,
    backgroundColor: '#0ea5e9',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 10,
  },
  popupPrimaryText: {
    color: '#fff',
    fontWeight: '700',
  },
  popupSecondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#0ea5e9',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 10,
  },
  popupSecondaryText: {
    color: '#0369a1',
    fontWeight: '700',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: SCREEN_H,
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  handleArea: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    marginBottom: 8,
  },
  sheetTitle: {
    alignSelf: 'flex-start',
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 16,
  },
  pumpCard: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomColor: '#f1f5f9',
    borderBottomWidth: 1,
  },
  pumpName: {
    color: '#0f172a',
    fontWeight: '700',
  },
  pumpAddress: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  metaText: {
    color: '#475569',
    fontSize: 11,
  },
  bookBtn: {
    backgroundColor: '#111827',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  bookBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  searchContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    color: '#0f172a',
  },
  cancel: {
    color: '#0284c7',
    fontWeight: '700',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  resultIcon: {
    fontSize: 20,
  },
  resultTitle: {
    color: '#0f172a',
    fontWeight: '700',
  },
  resultSub: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  empty: {
    textAlign: 'center',
    color: '#94a3b8',
    marginTop: 30,
  },
});
