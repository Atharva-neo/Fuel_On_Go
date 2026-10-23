import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { expoLocationProvider } from '../location/expoProvider';
import { reverseAddress } from '../location/area';
import { openLocationSettings } from '../location';
import { useTheme, type Theme } from '../theme';
import { MAP_USER_AGENT, mapThemeVars } from './mapKit';
import { pickerMapHtml } from './pickerMapHtml';
import {
  acquireOnce,
  applyAddress,
  applyAddressFailure,
  applyGpsFix,
  applyManualPoint,
  bboxSpanDeg,
  canConfirm,
  emptyPumpLocation,
  formatCoord,
  gpsProblemMessage,
  latestOnly,
  parseSearchHits,
  selectSearchResult,
  shouldStackLocationActions,
  type PumpLocationState,
  type SearchHit,
} from '../location/pumpLocation';

export interface ConfirmedPumpLocation {
  state: PumpLocationState;
  city: string;
  district: string;
  postcode: string;
}

interface Props {
  visible: boolean;
  /** Last confirmed selection; the picker reopens on it. */
  initial: ConfirmedPumpLocation | null;
  onConfirm: (loc: ConfirmedPumpLocation) => void;
  onClose: () => void;
}

const sourceLabel = { search: 'Address search', gps: 'Current GPS location', manual: 'Placed on map' } as const;
type Note = { tone: 'info' | 'warning' | 'error'; text: string; blocked?: boolean; retry?: boolean };

export default function PumpLocationPicker({ visible, initial, onConfirm, onClose }: Props) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // Side by side only when both labels fit comfortably; otherwise stack.
  const stackActions = shouldStackLocationActions(width);

  const [sel, setSel] = useState<PumpLocationState>(initial?.state ?? emptyPumpLocation);
  const [details, setDetails] = useState<{ seq: number; city: string; district: string; postcode: string } | null>(
    initial ? { seq: initial.state.seq, city: initial.city, district: initial.district, postcode: initial.postcode } : null
  );
  const [zoom, setZoom] = useState(5);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [searchNonce, setSearchNonce] = useState(0);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [note, setNote] = useState<Note | null>(null);
  const [ready, setReady] = useState(false);
  const [tiles, setTiles] = useState<'loading' | 'ok' | 'failed'>('loading');

  const webRef = useRef<WebView>(null);
  const inputRef = useRef<TextInput>(null);
  const html = useMemo(() => pickerMapHtml(t), []); // eslint-disable-line react-hooks/exhaustive-deps
  const searchGate = useRef(latestOnly<SearchHit[]>()).current;
  const gpsLock = useRef(false);
  const selRef = useRef(sel);
  selRef.current = sel;

  const post = useCallback((payload: any) => webRef.current?.postMessage(JSON.stringify(payload)), []);

  // Theme switches push CSS variables into the live map; position and pin are untouched.
  useEffect(() => {
    if (ready) post({ type: 'THEME', vars: mapThemeVars(t) });
  }, [t, ready, post]);

  // Reopening restores the last confirmed point (and resets transient UI).
  useEffect(() => {
    if (!visible) return;
    setSel(initial?.state ?? emptyPumpLocation);
    setDetails(initial ? { seq: initial.state.seq, city: initial.city, district: initial.district, postcode: initial.postcode } : null);
    setQuery('');
    setHits([]);
    setNote(null);
    setSearchError(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const fly = useCallback(
    (lat: number, lng: number, opts?: { bbox?: SearchHit['bbox']; zoom?: number }) => {
      post({ type: 'FLY', lat, lng, bbox: opts?.bbox ?? null, zoom: opts?.zoom });
    },
    [post]
  );

  // When the map finishes loading, show the restored point.
  useEffect(() => {
    if (ready && visible && sel.point) fly(sel.point.lat, sel.point.lng, { zoom: 17 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, visible]);

  // If no tile is ever drawn (offline / blocked), say so instead of staying blank.
  useEffect(() => {
    if (tiles !== 'loading' || !visible) return;
    const id = setTimeout(() => setTiles((s) => (s === 'loading' ? 'failed' : s)), 15000);
    return () => clearTimeout(id);
  }, [tiles, visible]);

  // ── address search: debounced, stale-proof ──
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setHits([]);
      setSearchError(false);
      setSearching(false);
      return;
    }
    const id = setTimeout(async () => {
      setSearching(true);
      setSearchError(false);
      try {
        const r = await searchGate(async () => {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=6&countrycodes=in`,
            { headers: { 'User-Agent': 'FuelOnGoApp/1.0', 'Accept-Language': 'en' } }
          );
          if (!res.ok) throw new Error(String(res.status));
          return parseSearchHits(await res.json());
        });
        if (!r.superseded) {
          setHits(r.value);
          setSearching(false);
        }
      } catch {
        setSearchError(true);
        setHits([]);
        setSearching(false);
      }
    }, 450);
    return () => clearTimeout(id);
  }, [query, searchGate, searchNonce]);

  const pickHit = (hit: SearchHit) => {
    Keyboard.dismiss();
    setFocused(false);
    const nextState = selectSearchResult(selRef.current, hit);
    setSel(nextState);
    setDetails(hit.details ? { seq: nextState.seq, ...hit.details } : null);
    setHits([]);
    setQuery('');
    setNote(null);
    const span = bboxSpanDeg(hit.bbox);
    fly(hit.lat, hit.lng, { bbox: span != null && span > 0.002 ? hit.bbox : null, zoom: 18 });
  };

  // ── one-time GPS (no watch) ──
  const useMyLocation = async () => {
    if (gpsLock.current) return;
    gpsLock.current = true;
    setGpsBusy(true);
    setNote(null);
    Keyboard.dismiss();
    setFocused(false);
    try {
      const r = await acquireOnce(expoLocationProvider);
      if (!r.ok) {
        // Previous valid selection is left untouched.
        setNote({ tone: 'error', text: gpsProblemMessage(r.reason), blocked: r.reason === 'permission_blocked', retry: true });
        return;
      }
      setSel((s) => applyGpsFix(s, r.fix));
      setDetails(null);
      setHits([]);
      setQuery('');
      fly(r.fix.lat, r.fix.lng, { zoom: 18 });
      const acc = r.fix.accuracy != null ? `GPS accuracy about ${Math.round(r.fix.accuracy)} m.` : 'GPS accuracy unknown.';
      // Only speak up when it matters; a good fix needs no extra panel.
      setNote(
        r.approximate
          ? {
              tone: 'warning',
              text: `${acc} ${r.reason === 'stale' ? 'This reading is old.' : 'Weak signal.'} Move the map to place the pin exactly.`,
              retry: true,
            }
          : { tone: 'info', text: `${acc} Move the map to fine-tune the pin.` }
      );
    } finally {
      gpsLock.current = false;
      setGpsBusy(false);
    }
  };

  // ── map events ──
  const onMessage = (raw: string) => {
    let d: any;
    try {
      d = JSON.parse(raw);
    } catch {
      return;
    }
    if (d.type === 'READY') return setReady(true);
    if (d.type === 'TILES_LOADED') return setTiles('ok');
    if (d.type === 'TILES_FAILED') return setTiles('failed');
    if (d.type === 'SETTLED') {
      setZoom(Number(d.zoom) || 0);
      if (d.programmatic) return; // the state already holds the selected point
      setSel((s) => applyManualPoint(s, Number(d.lat), Number(d.lng)));
    }
  };

  // ── reverse geocode after the point settles (never per drag frame) ──
  useEffect(() => {
    if (!visible || sel.addressStatus !== 'loading' || !sel.point) return;
    const seq = sel.seq;
    const { lat, lng } = sel.point;
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      try {
        const a = await reverseAddress(lat, lng, ctrl.signal);
        setSel((s) => applyAddress(s, seq, a.displayName));
        setDetails((d) => (seq === selRef.current.seq ? { seq, city: a.city, district: a.district, postcode: a.postcode } : d));
      } catch {
        if (!ctrl.signal.aborted) setSel((s) => applyAddressFailure(s, seq));
      }
    }, 600);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [sel.seq, sel.addressStatus, visible]);

  const confirm = () => {
    if (!canConfirm(sel)) return;
    const d = details && details.seq === sel.seq ? details : null;
    onConfirm({ state: sel, city: d?.city ?? '', district: d?.district ?? '', postcode: d?.postcode ?? '' });
  };

  const showSuggestions = focused && (query.trim().length >= 3 || hits.length > 0);
  const noteIcon = note?.tone === 'error' ? 'alert-circle-outline' : note?.tone === 'warning' ? 'alert-outline' : 'information-outline';

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeBtn}
            accessibilityLabel="Close"
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons name="close" size={24} color={t.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title} accessibilityRole="header">
            Pump Location
          </Text>
          <View style={styles.closeBtn} />
        </View>

        {/* Search + actions */}
        <View style={styles.controls}>
          <View style={styles.searchBox}>
            <MaterialCommunityIcons name="magnify" size={20} color={t.colors.textMuted} />
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              placeholder="Search address, landmark or area"
              placeholderTextColor={t.colors.placeholder}
              value={query}
              onChangeText={setQuery}
              onFocus={() => setFocused(true)}
              returnKeyType="search"
              autoCorrect={false}
              accessibilityLabel="Search address"
            />
            {searching ? (
              <ActivityIndicator size="small" color={t.colors.brandText} />
            ) : query.length > 0 ? (
              <TouchableOpacity accessibilityLabel="Clear search" onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialCommunityIcons name="close-circle" size={18} color={t.colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={[styles.actions, stackActions && styles.actionsStacked]}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionSecondary]}
              accessibilityRole="button"
              onPress={() => {
                setFocused(true);
                inputRef.current?.focus();
              }}
            >
              <MaterialCommunityIcons name="map-search-outline" size={20} color={t.colors.brandText} />
              <Text style={styles.actionSecondaryText} numberOfLines={1}>
                Search Address
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionPrimary, gpsBusy && { opacity: 0.6 }]}
              accessibilityRole="button"
              onPress={useMyLocation}
              disabled={gpsBusy}
            >
              {gpsBusy ? (
                <ActivityIndicator size="small" color={t.colors.onBrand} />
              ) : (
                <MaterialCommunityIcons name="crosshairs-gps" size={20} color={t.colors.onBrand} />
              )}
              <Text style={styles.actionPrimaryText} numberOfLines={1}>
                {gpsBusy ? 'Locating...' : 'Set My Current Location'}
              </Text>
            </TouchableOpacity>
          </View>

          {note ? (
            <View style={[styles.note, styles[`note_${note.tone}` as const]]}>
              <MaterialCommunityIcons
                name={noteIcon as any}
                size={18}
                color={note.tone === 'error' ? t.colors.dangerText : note.tone === 'warning' ? t.colors.warningText : t.colors.infoText}
              />
              <Text style={styles.noteText}>{note.text}</Text>
              {note.blocked ? (
                <TouchableOpacity onPress={openLocationSettings} accessibilityRole="button">
                  <Text style={styles.noteLink}>Settings</Text>
                </TouchableOpacity>
              ) : null}
              {note.retry ? (
                <TouchableOpacity onPress={useMyLocation} disabled={gpsBusy} accessibilityRole="button">
                  <Text style={styles.noteLink}>Retry</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* Map */}
        <View style={styles.mapBox}>
          <WebView
            ref={webRef}
            source={{ html }}
            style={styles.web}
            userAgent={MAP_USER_AGENT}
            originWhitelist={['*']}
            javaScriptEnabled
            onMessage={(e) => onMessage(e.nativeEvent.data)}
          />

          {tiles === 'loading' ? (
            <View style={styles.mapOverlay} pointerEvents="none">
              <ActivityIndicator size="small" color={t.colors.brandText} />
              <Text style={styles.mapOverlayText}>Loading map...</Text>
            </View>
          ) : null}
          {tiles === 'failed' ? (
            <View style={styles.mapOverlay}>
              <MaterialCommunityIcons name="map-marker-off-outline" size={18} color={t.colors.dangerText} />
              <Text style={styles.mapOverlayText}>Map tiles could not be loaded. Your selection is kept.</Text>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => {
                  setTiles('loading');
                  post({ type: 'RETRY_TILES' });
                }}
              >
                <Text style={styles.noteLink}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {sel.point ? (
            <TouchableOpacity
              style={styles.recenter}
              accessibilityLabel="Return to selected point"
              onPress={() => fly(sel.point!.lat, sel.point!.lng, { zoom: Math.max(zoom, 17) })}
            >
              <MaterialCommunityIcons name="target" size={22} color={t.colors.mapControlIcon} />
            </TouchableOpacity>
          ) : (
            <View style={styles.mapHint} pointerEvents="none">
              <Text style={styles.mapHintText}>Search an address or use your location, then zoom in and move the map to place the pin.</Text>
            </View>
          )}
        </View>

        {/* Bottom panel */}
        <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {sel.point ? (
            <>
              <Text style={styles.addr} numberOfLines={2}>
                {sel.addressStatus === 'loading'
                  ? 'Finding address...'
                  : sel.addressStatus === 'failed' || !sel.address
                  ? 'Address unavailable here (coordinates are still saved)'
                  : sel.address}
              </Text>
              <Text style={styles.coords}>
                {formatCoord(sel.point.lat)}, {formatCoord(sel.point.lng)}
              </Text>
              <Text style={styles.meta} numberOfLines={2}>
                {sel.source ? sourceLabel[sel.source] : ''}
                {sel.source === 'gps' && sel.accuracyM != null ? ` - GPS accuracy ~${Math.round(sel.accuracyM)} m` : ''}
                {zoom < 15 ? ' - zoom in for an exact spot' : ''}
                {' - Owner-selected, not independently verified'}
              </Text>
            </>
          ) : (
            <Text style={styles.addr}>No location selected yet.</Text>
          )}
          <TouchableOpacity
            style={[styles.confirm, !canConfirm(sel) && styles.confirmDisabled]}
            disabled={!canConfirm(sel)}
            accessibilityRole="button"
            onPress={confirm}
          >
            <Text style={styles.confirmText}>Confirm Pump Location</Text>
          </TouchableOpacity>
          <Text style={styles.attribution}>Address data (c) OpenStreetMap contributors</Text>
        </View>

        {/* Suggestions: a top-level layer so the map can never clip or cover it. */}
        {showSuggestions ? (
          <>
            <Pressable style={[styles.backdrop, { top: insets.top + 52 + 56 }]} onPress={() => { setFocused(false); Keyboard.dismiss(); }} accessibilityLabel="Dismiss suggestions" />
            <View style={[styles.suggestions, { top: insets.top + 52 + 56 }]}>
              <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled style={{ maxHeight: 260 }}>
                {searching && hits.length === 0 ? (
                  <View style={styles.suggestionRow}>
                    <ActivityIndicator size="small" color={t.colors.brandText} />
                    <Text style={styles.suggestionMuted}>Searching...</Text>
                  </View>
                ) : null}
                {searchError ? (
                  <View style={styles.suggestionRow}>
                    <MaterialCommunityIcons name="wifi-off" size={18} color={t.colors.dangerText} />
                    <Text style={[styles.suggestionMuted, { flex: 1 }]}>Couldn't search. Check your connection.</Text>
                    <TouchableOpacity onPress={() => setSearchNonce((n) => n + 1)} accessibilityRole="button">
                      <Text style={styles.noteLink}>Retry</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
                {!searching && !searchError && hits.length === 0 ? (
                  <View style={styles.suggestionRow}>
                    <MaterialCommunityIcons name="magnify-close" size={18} color={t.colors.textMuted} />
                    <Text style={styles.suggestionMuted}>No matching address. Try a nearby landmark or area.</Text>
                  </View>
                ) : null}
                {hits.map((h, i) => (
                  <TouchableOpacity
                    key={`${h.lat},${h.lng},${i}`}
                    style={[styles.suggestionRow, i < hits.length - 1 && styles.suggestionDivider]}
                    onPress={() => pickHit(h)}
                    accessibilityRole="button"
                  >
                    <MaterialCommunityIcons name="map-marker-outline" size={18} color={t.colors.textMuted} />
                    <Text style={styles.suggestionText} numberOfLines={2}>
                      {h.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </>
        ) : null}
      </View>
    </Modal>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.bg },
    header: {
      height: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
    },
    closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    title: { color: t.colors.text, fontWeight: '700', fontSize: 17 },
    controls: { paddingHorizontal: 16, gap: 10, zIndex: 2 },
    searchBox: {
      height: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      backgroundColor: t.colors.inputBg,
      borderWidth: 1,
      borderColor: t.colors.inputBorder,
      borderRadius: 12,
    },
    searchInput: { flex: 1, color: t.colors.text, fontSize: 15, paddingVertical: 0 },
    actions: { flexDirection: 'row', gap: 10 },
    actionsStacked: { flexDirection: 'column' },
    actionBtn: {
      flex: 1,
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 12,
      borderRadius: 12,
    },
    actionSecondary: { backgroundColor: t.colors.brandTint, borderWidth: 1, borderColor: t.colors.brand },
    actionSecondaryText: { color: t.colors.brandText, fontWeight: '700', fontSize: 14, flexShrink: 1 },
    actionPrimary: { backgroundColor: t.colors.brand },
    actionPrimaryText: { color: t.colors.onBrand, fontWeight: '800', fontSize: 14, flexShrink: 1 },
    note: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
    },
    note_info: { backgroundColor: t.colors.infoTint, borderColor: t.colors.info },
    note_warning: { backgroundColor: t.colors.warningTint, borderColor: t.colors.warning },
    note_error: { backgroundColor: t.colors.dangerTint, borderColor: t.colors.danger },
    noteText: { flex: 1, color: t.colors.text, fontSize: 12, lineHeight: 16 },
    noteLink: { color: t.colors.brandText, fontWeight: '800', fontSize: 13 },
    mapBox: { flex: 1, minHeight: 200, marginTop: 10, overflow: 'hidden', backgroundColor: t.colors.bgAlt },
    web: { flex: 1, backgroundColor: t.colors.bgAlt },
    mapOverlay: {
      position: 'absolute',
      top: 12,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: t.colors.surfaceRaised,
      borderWidth: 1,
      borderColor: t.colors.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      maxWidth: '92%',
    },
    mapOverlayText: { color: t.colors.textSecondary, fontSize: 12, fontWeight: '600', flexShrink: 1 },
    recenter: {
      position: 'absolute',
      right: 12,
      bottom: 36, // clear of the attribution line; status pills use the top edge
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: t.colors.mapControlBg,
      borderWidth: 1,
      borderColor: t.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mapHint: {
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: 28,
      backgroundColor: t.colors.surfaceRaised,
      borderWidth: 1,
      borderColor: t.colors.border,
      padding: 10,
      borderRadius: 10,
    },
    mapHintText: { color: t.colors.textSecondary, fontSize: 12, textAlign: 'center' },
    panel: {
      backgroundColor: t.colors.surface,
      paddingHorizontal: 16,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: t.colors.border,
    },
    addr: { color: t.colors.text, fontWeight: '600', fontSize: 14, lineHeight: 19 },
    coords: { color: t.colors.brandText, fontSize: 13, marginTop: 2, fontVariant: ['tabular-nums'] },
    meta: { color: t.colors.textSecondary, fontSize: 11, marginTop: 2, lineHeight: 15 },
    confirm: { backgroundColor: t.colors.brand, borderRadius: 12, minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
    confirmDisabled: { backgroundColor: t.colors.brandDisabled },
    confirmText: { color: t.colors.onBrand, fontWeight: '800', fontSize: 15 },
    attribution: { color: t.colors.textMuted, fontSize: 10, textAlign: 'center', marginTop: 6 },
    backdrop: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'transparent', zIndex: 20 },
    suggestions: {
      position: 'absolute',
      left: 16,
      right: 16,
      zIndex: 30,
      backgroundColor: t.colors.surfaceRaised,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.colors.border,
      overflow: 'hidden',
      elevation: 12,
      shadowColor: t.colors.shadow,
      shadowOpacity: 0.25,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    suggestionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 12 },
    suggestionDivider: { borderBottomWidth: 1, borderBottomColor: t.colors.divider },
    suggestionText: { flex: 1, color: t.colors.text, fontSize: 13, lineHeight: 18 },
    suggestionMuted: { color: t.colors.textSecondary, fontSize: 13 },
  });
