import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  FlatList,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  NativeViewGestureHandler,
  PanGestureHandler,
  State,
  type PanGestureHandlerGestureEvent,
  type PanGestureHandlerStateChangeEvent,
} from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import MapView from '../../components/MapView';
import { pumpService, type Pump } from '../../services/pump.service';
import { useLocationStore, type LocationBbox } from '../../store/locationStore';
import { useAuthStore } from '../../store/authStore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LocationIcon, SearchIcon } from '../../components/ui/Icons';
import { getCurrentDeviceLocation } from '../../utils/location';
import {
  SNAP_COLLAPSED,
  SNAP_EXPANDED,
  SNAP_PEEK,
  computeSheetTops,
  listOwnsRelease,
  nextSnapOnTap,
  pickSnapIndex,
  resolveDrag,
} from '../../utils/bottomSheetMath';

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

function PumpPopup({
  pump,
  onDismiss,
  onBook,
  onNavigate,
}: {
  pump: Pump;
  onDismiss: () => void;
  onBook: () => void;
  onNavigate: () => void;
}) {
  const dragY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        // only let it move downward -- swiping up shouldn't do anything
        if (g.dy >= 0) dragY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 60 || g.vy > 0.8) {
          onDismiss();
        } else {
          Animated.spring(dragY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
        }
      },
    })
  ).current;

  return (
    <Animated.View style={[styles.popup, { transform: [{ translateY: dragY }] }]}>
      <View {...panResponder.panHandlers} style={styles.popupHandleArea}>
        <View style={styles.popupHandle} />
      </View>
      <TouchableOpacity
        style={styles.popupClose}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        onPress={onDismiss}
      >
        <MaterialCommunityIcons name="close" size={18} color="#64748b" />
      </TouchableOpacity>
      <Text style={styles.popupName}>{pump.name}</Text>
      <Text style={styles.popupAddr} numberOfLines={1}>
        {pump.address}
      </Text>
      <View style={styles.popupActions}>
        <TouchableOpacity style={styles.popupPrimary} onPress={onBook}>
          <Text style={styles.popupPrimaryText}>View & Book</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.popupSecondary} onPress={onNavigate}>
          <Text style={styles.popupSecondaryText}>Navigate</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const PumpRow = React.memo(function PumpRow({
  pump,
  onBook,
  onPumpTap,
}: {
  pump: Pump;
  onBook: (pump: Pump) => void;
  onPumpTap: (pump: Pump) => void;
}) {
  return (
    <TouchableOpacity style={styles.pumpCard} onPress={() => onPumpTap(pump)}>
      <View style={{ flex: 1 }}>
        <Text style={styles.pumpName} numberOfLines={1}>
          {pump.name}
        </Text>
        <Text style={styles.pumpAddress} numberOfLines={1}>
          {pump.address}
        </Text>
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <LocationIcon size={12} color="#5f6368" />
            <Text style={styles.metaText}>{formatDistance(pump.distance_km)}</Text>
          </View>
          <Text style={styles.metaText}>₹{pump.cng_price_per_kg}/kg</Text>
          <Text style={[styles.metaText, { color: '#0f9d58', fontWeight: '700' }]}>
            {pump.available_slots_today ?? 0} slots
          </Text>
        </View>
      </View>
      <TouchableOpacity style={styles.bookBtn} onPress={() => onBook(pump)}>
        <Text style={styles.bookBtnText}>Book</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

// Draggable bottom sheet with a scrollable pump list.
//
// Gesture model (react-native-gesture-handler, no extra dependencies):
//  * One PanGestureHandler wraps the whole sheet (handle, title and list), so
//    the sheet can be dragged from anywhere on it.
//  * The list sits in a NativeViewGestureHandler that runs *simultaneously*
//    with the pan, which lets both observe the same touch.
//  * The list only scrolls when the sheet is fully expanded (scrollEnabled).
//    In every other state a vertical drag anywhere moves the sheet.
//  * While expanded, resolveDrag() decides per frame who owns the gesture: if
//    the list is scrolled away from the top it keeps scrolling; once it is at
//    the top, a continued downward drag collapses the sheet.
function NearbyBottomSheet({
  pumps,
  loading,
  error,
  onRetry,
  onBook,
  onPumpTap,
  containerH,
  topInset,
  sheetTop,
  isFocused,
  onSnapChange,
  listBottomPadding,
}: {
  pumps: Pump[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onBook: (pump: Pump) => void;
  onPumpTap: (pump: Pump) => void;
  containerH: number;
  topInset: number;
  sheetTop: Animated.Value;
  isFocused: boolean;
  onSnapChange: (index: number) => void;
  listBottomPadding: number;
}) {
  const tops = useMemo(() => computeSheetTops(containerH, topInset), [containerH, topInset]);
  const topsRef = useRef(tops);
  topsRef.current = tops;

  const [scrollEnabled, setScrollEnabled] = useState(false);
  const scrollEnabledRef = useRef(false);
  const [snapIndex, setSnapIndex] = useState(SNAP_PEEK);
  const snapIndexRef = useRef(SNAP_PEEK);
  const reduceMotionRef = useRef(false);

  const panRef = useRef<any>(null);
  const nativeRef = useRef<any>(null);
  const listRef = useRef<FlatList<Pump>>(null);
  const posRef = useRef(tops[SNAP_PEEK]);
  const scrollY = useRef(0);
  const drag = useRef({ startPos: tops[SNAP_PEEK], baseline: 0 });
  const onSnapChangeRef = useRef(onSnapChange);
  onSnapChangeRef.current = onSnapChange;

  useEffect(() => {
    const id = sheetTop.addListener(({ value }) => {
      posRef.current = value;
    });
    return () => sheetTop.removeListener(id);
  }, [sheetTop]);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      reduceMotionRef.current = v;
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
      reduceMotionRef.current = v;
    });
    return () => sub.remove();
  }, []);

  const applyScrollEnabled = (value: boolean) => {
    if (scrollEnabledRef.current !== value) {
      scrollEnabledRef.current = value;
      setScrollEnabled(value);
    }
  };

  const snapTo = (index: number, animated = true) => {
    const target = topsRef.current[index];
    snapIndexRef.current = index;
    setSnapIndex(index);
    onSnapChangeRef.current(index);

    if (index === SNAP_EXPANDED) {
      applyScrollEnabled(true);
    } else {
      applyScrollEnabled(false);
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
      scrollY.current = 0;
    }

    sheetTop.stopAnimation();
    if (!animated || reduceMotionRef.current) {
      sheetTop.setValue(target);
      return;
    }
    Animated.spring(sheetTop, {
      toValue: target,
      useNativeDriver: false,
      tension: 70,
      friction: 12,
    }).start();
  };

  // Keep the sheet on its snap point if the container is resized (first
  // layout, rotation, keyboard/system-bar changes).
  useEffect(() => {
    sheetTop.stopAnimation();
    sheetTop.setValue(tops[snapIndexRef.current]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tops]);

  // Android back: step the sheet down one state instead of leaving the screen.
  useEffect(() => {
    if (!isFocused) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (snapIndexRef.current < SNAP_PEEK) {
        snapTo(SNAP_PEEK);
        return true;
      }
      return false;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);

  const onPanStateChange = (e: PanGestureHandlerStateChangeEvent) => {
    const { state, oldState, translationY, velocityY } = e.nativeEvent;
    if (state === State.ACTIVE) {
      sheetTop.stopAnimation();
      drag.current = { startPos: posRef.current, baseline: translationY };
    } else if (oldState === State.ACTIVE) {
      const [expandedTop] = topsRef.current;
      if (listOwnsRelease(posRef.current, scrollY.current, expandedTop)) return;
      snapTo(pickSnapIndex(topsRef.current, posRef.current, velocityY));
    }
  };

  const onPanEvent = (e: PanGestureHandlerGestureEvent) => {
    const t = topsRef.current;
    const result = resolveDrag({
      ...drag.current,
      translationY: e.nativeEvent.translationY,
      pos: posRef.current,
      listScrollY: scrollY.current,
      expandedTop: t[0],
      collapsedTop: t[t.length - 1],
    });
    drag.current = { startPos: result.startPos, baseline: result.baseline };
    if (result.owner === 'list') return;
    sheetTop.setValue(result.next);
    if (result.next <= t[0] + 0.5) applyScrollEnabled(true);
  };

  const translateY = useMemo(() => Animated.subtract(sheetTop, tops[0]), [sheetTop, tops]);

  const renderItem = useCallback(
    ({ item }: { item: Pump }) => <PumpRow pump={item} onBook={onBook} onPumpTap={onPumpTap} />,
    [onBook, onPumpTap]
  );

  if (!containerH) return null;

  const title = loading ? 'Finding CNG pumps…' : `${pumps.length} CNG pumps nearby`;

  return (
    <PanGestureHandler
      ref={panRef}
      simultaneousHandlers={nativeRef}
      onGestureEvent={onPanEvent}
      onHandlerStateChange={onPanStateChange}
      activeOffsetY={[-10, 10]}
      failOffsetX={[-30, 30]}
      shouldCancelWhenOutside={false}
    >
      <Animated.View
        collapsable={false}
        style={[styles.sheet, { top: tops[0], height: containerH - tops[0], transform: [{ translateY }] }]}
      >
        <Pressable
          style={styles.handleArea}
          onPress={() => snapTo(nextSnapOnTap(snapIndexRef.current))}
          accessibilityRole="adjustable"
          accessibilityLabel={title}
          accessibilityHint="Swipe up or down to expand or collapse the pump list"
          accessibilityValue={{ text: ['Expanded', 'Half open', 'Preview', 'Collapsed'][snapIndex] }}
          accessibilityActions={[
            { name: 'increment', label: 'Expand' },
            { name: 'decrement', label: 'Collapse' },
          ]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === 'increment') snapTo(Math.max(SNAP_EXPANDED, snapIndexRef.current - 1));
            else snapTo(Math.min(SNAP_COLLAPSED, snapIndexRef.current + 1));
          }}
        >
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>{title}</Text>
        </Pressable>

        <NativeViewGestureHandler ref={nativeRef} simultaneousHandlers={panRef}>
          <FlatList
            ref={listRef}
            style={styles.sheetList}
            data={loading ? [] : pumps}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            scrollEnabled={scrollEnabled}
            scrollEventThrottle={16}
            onScroll={(e) => {
              scrollY.current = e.nativeEvent.contentOffset.y;
            }}
            bounces={false}
            overScrollMode="never"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={8}
            windowSize={7}
            contentContainerStyle={[styles.sheetListContent, { paddingBottom: listBottomPadding }]}
            ListEmptyComponent={
              loading ? (
                <ActivityIndicator style={{ marginTop: 24 }} color="#0ea5e9" />
              ) : error ? (
                <View style={styles.sheetState}>
                  <Text style={styles.sheetStateText}>Couldn't load nearby pumps.</Text>
                  <TouchableOpacity style={styles.sheetRetry} onPress={onRetry}>
                    <Text style={styles.sheetRetryText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.sheetState}>
                  <Text style={styles.sheetStateText}>No CNG pumps found nearby.</Text>
                </View>
              )
            }
          />
        </NativeViewGestureHandler>
      </Animated.View>
    </PanGestureHandler>
  );
}

export default function HomeScreen({ navigation }: any) {
  const { lat, lng, city, displayName, bbox, isSet, setLocation } = useLocationStore();

  const [pumps, setPumps] = useState<Pump[]>([]);
  const [loadingPumps, setLoadingPumps] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedPump, setSelectedPump] = useState<Pump | null>(null);
  const [loadError, setLoadError] = useState(false);

  // Real size of the area the sheet lives in (above the tab bar), not the
  // window height -- the sheet's snap points are derived from this.
  const [containerH, setContainerH] = useState(0);
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const sheetTop = useRef(new Animated.Value(0)).current;
  const [sheetIndex, setSheetIndex] = useState(SNAP_PEEK);
  const [popupH, setPopupH] = useState(150);
  const sheetTops = useMemo(() => computeSheetTops(containerH, insets.top), [containerH, insets.top]);
  // The selected-pump card rides just above the sheet while it is collapsed,
  // peeking or half open, and when the sheet is fully open it settles at the
  // bottom of the screen so it is still reachable (and can be swiped away).
  const popupY = useMemo(
    () =>
      sheetTop.interpolate({
        inputRange: sheetTops,
        outputRange: [
          containerH - popupH - 12,
          sheetTops[1] - popupH - 10,
          sheetTops[2] - popupH - 10,
          sheetTops[3] - popupH - 10,
        ],
        extrapolate: 'clamp',
      }),
    [sheetTop, sheetTops, containerH, popupH]
  );
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
    setLoadError(false);
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
      setLoadError(true);
    } finally {
      setLoadingPumps(false);
    }
  };

  useEffect(() => {
    loadNearby();
  }, [lat, lng, regionBbox?.north, regionBbox?.south, regionBbox?.east, regionBbox?.west]);

  // Use the device's real GPS position (not the hardcoded Kolhapur default)
  // as soon as the user opens the map, so "You" and every pump's distance
  // reflect where they actually are. Only runs once per session and only
  // if they haven't already picked a location via search -- that stays in
  // charge once they've explicitly browsed elsewhere.
  useEffect(() => {
    if (isSet) return;
    let cancelled = false;
    getCurrentDeviceLocation().then((loc) => {
      if (cancelled || !loc) return;
      setLocation(loc);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setSelectedPump(null);

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

  const onBookPump = useCallback(
    (pump: Pump) => {
      navigation.getParent()?.navigate('PumpDetail', { pumpId: pump.id });
    },
    [navigation]
  );
  const onPumpTap = useCallback((pump: Pump) => setSelectedPump(pump), []);
  const retryNearby = useCallback(() => {
    loadNearby();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, regionBbox]);

  return (
    <View
      style={styles.root}
      onLayout={(e) => {
        const h = Math.round(e.nativeEvent.layout.height);
        setContainerH((prev) => (Math.abs(prev - h) > 1 ? h : prev));
      }}
    >
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
          <View style={styles.locationTitleRow}>
            <LocationIcon size={12} color="#0A0A0A" />
            <Text style={styles.locationText}>{city}</Text>
          </View>
          <Text style={styles.locationSub} numberOfLines={1}>
            {displayName}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.searchBtn} onPress={() => setSearchVisible(true)}>
          <SearchIcon size={20} color="#0A0A0A" />
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
          <MaterialCommunityIcons name="logout" size={18} color="#0A0A0A" />
        </TouchableOpacity>
      </View>

      {selectedPump && containerH > 0 ? (
        <Animated.View
          style={[styles.popupAnchor, { transform: [{ translateY: popupY }] }]}
          onLayout={(e) => setPopupH(Math.round(e.nativeEvent.layout.height))}
        >
          <PumpPopup
            pump={selectedPump}
            onDismiss={() => setSelectedPump(null)}
            onBook={() => navigation.getParent()?.navigate('PumpDetail', { pumpId: selectedPump.id })}
            onNavigate={() =>
              navigation.navigate('Navigation', {
                lat: selectedPump.lat,
                lng: selectedPump.lng,
                pumpName: selectedPump.name,
                address: selectedPump.address,
              })
            }
          />
        </Animated.View>
      ) : null}

      <NearbyBottomSheet
        pumps={pumps}
        loading={loadingPumps}
        error={loadError}
        onRetry={retryNearby}
        onBook={onBookPump}
        onPumpTap={onPumpTap}
        containerH={containerH}
        topInset={insets.top}
        sheetTop={sheetTop}
        isFocused={isFocused}
        onSnapChange={setSheetIndex}
        listBottomPadding={selectedPump && sheetIndex === SNAP_EXPANDED ? popupH + 24 : 24}
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
                <MaterialCommunityIcons
                  name={item.type === 'pump' ? 'gas-station' : 'map-marker-outline'}
                  size={20}
                  color="#0A0A0A"
                />
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
  locationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
  popupAnchor: {
    position: 'absolute',
    top: 0,
    left: 14,
    right: 14,
    zIndex: 30,
  },
  popup: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  popupHandleArea: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  popupHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
  },
  popupClose: {
    position: 'absolute',
    top: 8,
    right: 10,
    zIndex: 1,
  },
  popupName: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 15,
    paddingRight: 24,
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
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 21,
  },
  handleArea: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
  },
  sheetList: {
    flex: 1,
  },
  sheetListContent: {
    flexGrow: 1,
  },
  sheetState: {
    alignItems: 'center',
    paddingTop: 28,
    paddingHorizontal: 24,
    gap: 12,
  },
  sheetStateText: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
  },
  sheetRetry: {
    backgroundColor: '#0ea5e9',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sheetRetryText: {
    color: '#fff',
    fontWeight: '700',
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
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
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
