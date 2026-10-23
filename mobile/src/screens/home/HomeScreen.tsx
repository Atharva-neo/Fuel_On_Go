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
import MapView, { type CameraCommand } from '../../components/MapView';
import { pumpService, type Pump } from '../../services/pump.service';
import { useLocationStore, type LocationBbox } from '../../store/locationStore';
import { useAuthStore } from '../../store/authStore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LocationIcon, SearchIcon } from '../../components/ui/Icons';
import {
  describeLocationProblem,
  locationController,
  openLocationSettings,
  useDeviceLocation,
  useLocationSession,
} from '../../location';
import { LOCATION_CONFIG } from '../../location/config';
import { formatStraightLine, movedMoreThan, rankPumps } from '../../location/geo';
import { createNearbyLoader, type NearbyState } from '../../location/nearbyLoader';
import * as camera from '../../location/cameraPolicy';
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
import ThemeToggle from '../../components/ThemeToggle';
import RatingBadge from '../../components/RatingBadge';
import { useRatingEvents } from '../../ratings/ratingEvents';
import { useTheme, type Theme } from '../../theme';

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
      type: 'device';
      id: string;
      title: string;
      subtitle: string;
    }
  | {
      type: 'pump';
      id: string;
      title: string;
      subtitle: string;
      pumpId: string;
    };

// Straight-line distance from the device; never presented as road distance.
const formatDistance = formatStraightLine;

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
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
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
        <MaterialCommunityIcons name="close" size={18} color={t.colors.textSecondary} />
      </TouchableOpacity>
      <Text style={styles.popupName}>{pump.name}</Text>
      <Text style={styles.popupAddr} numberOfLines={1}>
        {pump.address}
      </Text>
      <View style={{ marginBottom: 6 }}>
        <RatingBadge average={pump.rating_avg} count={pump.rating_count} size={13} />
      </View>
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
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
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
            <LocationIcon size={12} color={t.colors.textSecondary} />
            <Text style={styles.metaText}>{formatDistance(pump.distance_km)}</Text>
          </View>
          <RatingBadge average={pump.rating_avg} count={pump.rating_count} />
          <Text style={styles.metaText}>₹{pump.cng_price_per_kg}/kg</Text>
          <Text style={[styles.metaText, { color: t.colors.successText, fontWeight: '700' }]}>
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
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
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
                <ActivityIndicator style={{ marginTop: 24 }} color={t.colors.infoText} />
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
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  // Live device position: one shared session for the whole app. This screen
  // is focused => GPS runs; blurred/background => it is released.
  useLocationSession(true);
  const dev = useDeviceLocation();
  // The area the user is browsing (a searched place). Independent of GPS.
  const { mode, lat: mLat, lng: mLng, city: mCity, displayName: mDisplay, bbox, setLocation, followDevice } = useLocationStore();
  const browsing = mode === 'manual';

  const deviceCoord = useMemo(
    () => (dev.fix ? { lat: dev.fix.lat, lng: dev.fix.lng } : null),
    [dev.fix?.lat, dev.fix?.lng]
  );
  // Only a fresh GPS reading is allowed to produce "your distance".
  const liveCoord = dev.isFresh ? deviceCoord : null;
  const center = browsing ? (mLat != null && mLng != null ? { lat: mLat, lng: mLng } : null) : deviceCoord;

  const [nearby, setNearby] = useState<NearbyState<Pump>>({ status: 'idle', pumps: [] });
  const pumps = useMemo(() => rankPumps(nearby.pumps, liveCoord), [nearby.pumps, liveCoord]);
  const loadingPumps = nearby.status === 'loading' && nearby.pumps.length === 0;
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedPump, setSelectedPump] = useState<Pump | null>(null);
  const loadError = nearby.status === 'error';

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
  } | null>(
    browsing && bbox && mLat != null && mLng != null
      ? { lat: mLat, lng: mLng, bbox: [String(bbox.south), String(bbox.north), String(bbox.west), String(bbox.east)] }
      : null
  );

  const regionBbox = useMemo(() => (browsing ? bbox ?? null : null), [browsing, bbox]);

  // ── nearby pumps: debounced, movement-thresholded, stale-proof ──────────
  const loader = useMemo(
    () =>
      createNearbyLoader<Pump>({
        debounceMs: LOCATION_CONFIG.nearbyDebounceMs,
        onState: setNearby,
        fetchNearby: (p, signal) => pumpService.getNearby({ ...p, signal }),
      }),
    []
  );
  useEffect(() => () => loader.cancel(), [loader]);

  const lastReq = useRef<{ key: string; center: { lat: number; lng: number } | null } | null>(null);
  const reqKey = browsing
    ? `m:${mLat}:${mLng}:${bbox?.north}:${bbox?.south}:${bbox?.east}:${bbox?.west}`
    : 'device';

  useEffect(() => {
    // Wait for the first GPS answer before asking for coordinate-less results.
    const settling = !browsing && !center && !dev.error && (dev.status === 'idle' || dev.status === 'requesting' || dev.status === 'acquiring');
    if (settling) return;

    const prev = lastReq.current;
    const keyChanged = !prev || prev.key !== reqKey;
    if (!keyChanged) {
      if (browsing) return;
      // Device mode: refetch only when the user actually moved, or when a position first appeared.
      if (prev!.center && center && !movedMoreThan(prev!.center, center, LOCATION_CONFIG.nearbyMoveM)) return;
      if (!prev!.center && !center) return;
    }
    lastReq.current = { key: reqKey, center };
    loader.request(
      {
        lat: center?.lat,
        lng: center?.lng,
        bbox: regionBbox,
        radius: LOCATION_CONFIG.nearbyRadiusM,
      },
      keyChanged
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reqKey, center?.lat, center?.lng, dev.status, dev.error]);

  // ── map camera: centre on first fix, follow only while the user lets it ──
  const camRef = useRef(camera.initialCamera);
  const camSeq = useRef(0);
  const [cameraCmd, setCameraCmd] = useState<CameraCommand | null>(null);
  const [following, setFollowing] = useState(true);
  const issueCamera = useCallback((la: number, ln: number, zoom?: number, animate = false) => {
    camSeq.current += 1;
    setCameraCmd({ seq: camSeq.current, lat: la, lng: ln, zoom, animate });
  }, []);

  useEffect(() => {
    if (!dev.fix) return;
    const r = camera.onFix(camRef.current, browsing);
    camRef.current = r.state;
    if (r.action === 'center-first') issueCamera(dev.fix.lat, dev.fix.lng, 14, false);
    else if (r.action === 'follow') issueCamera(dev.fix.lat, dev.fix.lng, undefined, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dev.fix?.lat, dev.fix?.lng, dev.fix?.timestamp]);

  const onUserGesture = useCallback(() => {
    camRef.current = camera.onUserGesture(camRef.current);
    setFollowing(false);
  }, []);

  // "My location" / "Use my current location": back to the real GPS position.
  const goToMyLocation = useCallback(() => {
    if (browsing) {
      followDevice();
      setSearchRegion(null);
      setSelectedPump(null);
    }
    if (dev.fix) {
      const r = camera.onRecenter(camRef.current);
      camRef.current = r.state;
      setFollowing(true);
      issueCamera(dev.fix.lat, dev.fix.lng, 15, true);
    } else if (dev.error === 'permission_blocked') {
      openLocationSettings();
    } else {
      locationController.retry();
    }
  }, [browsing, dev.fix, dev.error, issueCamera, followDevice]);

  // ── header text: honest about what it is showing ────────────────────────
  const areaName = dev.areaState.area?.name;
  const city = browsing ? mCity : areaName ?? (dev.fix ? 'Current location' : dev.error ? 'Location unavailable' : 'Locating...');
  const displayName = browsing
    ? mDisplay
    : dev.areaState.area?.displayName ?? (dev.fix && dev.fix.source === 'cached' ? 'Approximate (last known)' : 'Using your device location');
  const problem = browsing ? null : describeLocationProblem(dev);
  const areaFailed = !browsing && !problem && dev.fix && dev.areaState.status === 'failed';

  useEffect(() => {
    if (!searchText.trim()) {
      setResults([]);
      return;
    }

    const id = setTimeout(async () => {
      try {
        // Prefer places close to where the user actually is (soft bias, not a filter).
        const bias = deviceCoord
          ? `&viewbox=${deviceCoord.lng - 0.5},${deviceCoord.lat + 0.5},${deviceCoord.lng + 0.5},${deviceCoord.lat - 0.5}&bounded=0`
          : '';
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(`${searchText}, Maharashtra, India`)}&format=json&addressdetails=1&limit=8${bias}`;
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

    if (result.type === 'device') {
      setSearchVisible(false);
      setSearchText('');
      goToMyLocation();
      return;
    }

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
  };

  const onBookPump = useCallback(
    (pump: Pump) => {
      navigation.getParent()?.navigate('PumpDetail', { pumpId: pump.id });
    },
    [navigation]
  );
  const onPumpTap = useCallback((pump: Pump) => setSelectedPump(pump), []);
  const retryNearby = useCallback(() => {
    lastReq.current = { key: reqKey, center };
    loader.request(
      { lat: center?.lat, lng: center?.lng, bbox: regionBbox, radius: LOCATION_CONFIG.nearbyRadiusM },
      true
    );
  }, [loader, reqKey, center, regionBbox]);

  // A rating was just saved somewhere: refetch so list averages are never stale.
  const ratingsVersion = useRatingEvents((s) => s.version);
  useEffect(() => {
    if (ratingsVersion > 0) retryNearby();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratingsVersion]);

  // What the search modal offers before the user types anything.
  const suggestions = useMemo<SearchResult[]>(() => {
    const list: SearchResult[] = [
      {
        type: 'device',
        id: 'device',
        title: 'Use my current location',
        subtitle: dev.areaState.area?.displayName ?? (dev.fix ? 'Your GPS position' : 'Location not available yet'),
      },
    ];
    pumps.slice(0, 3).forEach((pump) =>
      list.push({
        type: 'pump',
        id: `pump-${pump.id}`,
        title: pump.name,
        subtitle: `${formatDistance(pump.distance_km)} · ${pump.address}`,
        pumpId: pump.id,
      })
    );
    return list;
  }, [pumps, dev.fix, dev.areaState.area]);

  return (
    <View
      style={styles.root}
      onLayout={(e) => {
        const h = Math.round(e.nativeEvent.layout.height);
        setContainerH((prev) => (Math.abs(prev - h) > 1 ? h : prev));
      }}
    >
      <MapView
        device={
          dev.fix
            ? { lat: dev.fix.lat, lng: dev.fix.lng, accuracy: dev.fix.accuracy, live: dev.isFresh }
            : null
        }
        pumps={pumps}
        searchRegion={searchRegion}
        cameraCommand={cameraCmd}
        onUserGesture={onUserGesture}
        onPumpPress={(pumpId) => {
          const found = pumps.find((p) => p.id === pumpId) || null;
          setSelectedPump(found);
        }}
      />

      <View style={styles.topBar}>
        <TouchableOpacity style={styles.locationPill} onPress={() => setSearchVisible(true)}>
          <View style={styles.locationTitleRow}>
            <LocationIcon size={12} color={t.colors.text} />
            <Text style={styles.locationText}>{city}</Text>
          </View>
          <Text style={styles.locationSub} numberOfLines={1}>
            {displayName}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.searchBtn} onPress={() => setSearchVisible(true)}>
          <SearchIcon size={20} color={t.colors.text} />
        </TouchableOpacity>

        <ThemeToggle size={20} style={{ backgroundColor: t.colors.mapControlBg, borderColor: t.colors.border }} />

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
          <MaterialCommunityIcons name="logout" size={18} color={t.colors.text} />
        </TouchableOpacity>
      </View>

      {problem || areaFailed ? (
        <View style={styles.locBanner}>
          <Text style={styles.locBannerText} numberOfLines={2}>
            {problem ?? "Couldn't detect your area."}
          </Text>
          <TouchableOpacity
            onPress={() => {
              if (dev.error === 'permission_blocked') openLocationSettings();
              else if (areaFailed) locationController.retryArea();
              else locationController.retry();
            }}
          >
            <Text style={styles.locBannerAction}>
              {dev.error === 'permission_blocked' ? 'Settings' : 'Retry'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <TouchableOpacity
        style={styles.myLocBtn}
        accessibilityLabel={browsing ? 'Use my current location' : 'Center map on my location'}
        onPress={goToMyLocation}
      >
        <MaterialCommunityIcons
          name={following && !browsing ? 'crosshairs-gps' : 'crosshairs'}
          size={22}
          color={following && !browsing && dev.isFresh ? t.colors.infoText : t.colors.textSecondary}
        />
      </TouchableOpacity>

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
            data={searchText.trim() ? results : suggestions}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.resultRow} onPress={() => onResultSelect(item)}>
                <MaterialCommunityIcons
                  name={item.type === 'pump' ? 'gas-station' : item.type === 'device' ? 'crosshairs-gps' : 'map-marker-outline'}
                  size={20}
                  color={t.colors.text}
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

const createStyles = (t: Theme) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: t.colors.bg,
  },
  topBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 34,
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 20,
  },
  locationPill: {
    backgroundColor: t.colors.mapControlBg,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flex: 1,
    minWidth: 0,
  },
  locationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    color: t.colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  locationSub: {
    color: t.colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  locBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 112 : 90,
    left: 14,
    right: 70,
    zIndex: 19,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: t.colors.warningTint,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: t.colors.warning,
  },
  locBannerText: { flex: 1, color: t.colors.warningText, fontSize: 12 },
  locBannerAction: { color: t.colors.infoText, fontWeight: '800', fontSize: 13 },
  myLocBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 112 : 90,
    right: 14,
    zIndex: 19,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: t.colors.mapControlBg,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  searchBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: t.colors.mapControlBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchIcon: {
    fontSize: 18,
  },
  logoutIcon: {
    fontSize: 20,
    color: t.colors.dangerText,
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
    backgroundColor: t.colors.surface,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: t.colors.border,
    shadowColor: t.colors.shadow,
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
    backgroundColor: t.colors.surfaceAlt,
  },
  popupClose: {
    position: 'absolute',
    top: 8,
    right: 10,
    zIndex: 1,
  },
  popupName: {
    color: t.colors.text,
    fontWeight: '800',
    fontSize: 15,
    paddingRight: 24,
  },
  popupAddr: {
    color: t.colors.textSecondary,
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
    backgroundColor: t.colors.info,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 10,
  },
  popupPrimaryText: {
    color: t.colors.onInfo,
    fontWeight: '700',
  },
  popupSecondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: t.colors.info,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 10,
  },
  popupSecondaryText: {
    color: t.colors.infoText,
    fontWeight: '700',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: t.colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    shadowColor: t.colors.shadow,
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
    borderBottomColor: t.colors.border,
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
    color: t.colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  sheetRetry: {
    backgroundColor: t.colors.info,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sheetRetryText: {
    color: t.colors.onInfo,
    fontWeight: '700',
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: t.colors.surfaceAlt,
    marginBottom: 8,
  },
  sheetTitle: {
    alignSelf: 'flex-start',
    color: t.colors.text,
    fontWeight: '700',
    fontSize: 16,
  },
  pumpCard: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomColor: t.colors.border,
    borderBottomWidth: 1,
  },
  pumpName: {
    color: t.colors.text,
    fontWeight: '700',
  },
  pumpAddress: {
    color: t.colors.textSecondary,
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
    color: t.colors.textSecondary,
    fontSize: 11,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  bookBtn: {
    backgroundColor: t.colors.inverse,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  bookBtnText: {
    color: t.colors.onInverse,
    fontWeight: '700',
    fontSize: 12,
  },
  searchContainer: {
    flex: 1,
    backgroundColor: t.colors.surface,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  searchInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    color: t.colors.text,
  },
  cancel: {
    color: t.colors.infoText,
    fontWeight: '700',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  resultTitle: {
    color: t.colors.text,
    fontWeight: '700',
  },
  resultSub: {
    color: t.colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  empty: {
    textAlign: 'center',
    color: t.colors.textMuted,
    marginTop: 30,
  },
});
