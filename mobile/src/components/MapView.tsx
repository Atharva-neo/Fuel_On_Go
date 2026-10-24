import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme, type Theme } from '../theme';
import { MAP_USER_AGENT, mapThemeVars } from './mapKit';
import { homeMapHtml } from './homeMapHtml';
import { useT } from '../i18n';

interface PumpMarker {
  id: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  available_slots_today?: number;
  distance_km?: number;
}

interface SearchRegion {
  lat: number;
  lng: number;
  bbox?: [string | number, string | number, string | number, string | number] | null;
}

export interface DeviceMarker {
  lat: number;
  lng: number;
  accuracy?: number | null;
  /** false = cached / out-of-date position: drawn grey, no accuracy halo. */
  live: boolean;
}

export interface CameraCommand {
  seq: number;
  lat: number;
  lng: number;
  zoom?: number;
  animate?: boolean;
}

interface Props {
  device: DeviceMarker | null;
  pumps: PumpMarker[];
  searchRegion?: SearchRegion | null;
  cameraCommand?: CameraCommand | null;
  onUserGesture?: () => void;
  onPumpPress?: (pumpId: string) => void;
}

export default function MapView({ device, pumps, searchRegion, cameraCommand, onUserGesture, onPumpPress }: Props) {
  const t = useTheme();
  const { tr } = useT();
  const styles = useMemo(() => createStyles(t), [t]);
  const webViewRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [tiles, setTiles] = useState<'loading' | 'ok' | 'failed'>('loading');

  // Built once with the theme at mount; later theme changes are pushed as CSS
  // variables, so the map keeps its position, markers and zoom.
  const html = useMemo(() => homeMapHtml(t), []); // eslint-disable-line react-hooks/exhaustive-deps

  const post = (payload: any) => {
    if (!ready) return;
    webViewRef.current?.postMessage(JSON.stringify(payload));
  };

  useEffect(() => {
    post({ type: 'THEME', vars: mapThemeVars(t) });
  }, [t, ready]);

  useEffect(() => {
    post({
      type: 'UPDATE_LOCATION',
      lat: device?.lat ?? null,
      lng: device?.lng ?? null,
      accuracy: device?.accuracy ?? null,
      live: !!device?.live,
    });
  }, [device?.lat, device?.lng, device?.accuracy, device?.live, ready]);

  useEffect(() => {
    if (cameraCommand) post({ type: 'CENTER', ...cameraCommand });
  }, [cameraCommand?.seq, ready]);

  useEffect(() => {
    post({
      type: 'UPDATE_PUMPS',
      pumps,
      labels: { slotsSuffix: tr('map.slotsSuffix'), kmSuffix: tr('map.kmSuffix'), pumpFallback: tr('map.pumpFallback') },
    });
  }, [pumps, ready, tr]);

  useEffect(() => {
    if (searchRegion?.bbox) {
      post({
        type: 'ZOOM_REGION',
        bbox: searchRegion.bbox,
        lat: searchRegion.lat,
        lng: searchRegion.lng,
      });
    }
  }, [searchRegion, ready]);

  // If the page never reports a drawn tile (offline, blocked), say so instead of staying blank.
  useEffect(() => {
    if (tiles !== 'loading') return;
    const id = setTimeout(() => setTiles((s) => (s === 'loading' ? 'failed' : s)), 15000);
    return () => clearTimeout(id);
  }, [tiles]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={styles.webview}
        userAgent={MAP_USER_AGENT}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'MAP_READY') {
              setReady(true);
              return;
            }
            if (data.type === 'TILES_LOADED') return setTiles('ok');
            if (data.type === 'TILES_FAILED') return setTiles('failed');
            if (data.type === 'USER_GESTURE') {
              onUserGesture?.();
              return;
            }
            if (data.type === 'PUMP_TAP' && onPumpPress) {
              onPumpPress(data.pumpId);
            }
          } catch {
            // noop
          }
        }}
      />
      {tiles === 'loading' ? (
        <View style={styles.status} pointerEvents="none">
          <ActivityIndicator size="small" color={t.colors.brandText} />
          <Text style={styles.statusText}>{tr('map.loading')}</Text>
        </View>
      ) : null}
      {tiles === 'failed' ? (
        <View style={styles.status}>
          <Text style={styles.statusText}>{tr('nav.tilesFailed')}</Text>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => {
              setTiles('loading');
              post({ type: 'RETRY_TILES' });
            }}
          >
            <Text style={styles.retry}>{tr('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.colors.bgAlt,
    },
    webview: {
      flex: 1,
      backgroundColor: t.colors.bgAlt,
    },
    status: {
      position: 'absolute',
      top: 188,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: t.colors.surfaceRaised,
      borderColor: t.colors.border,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
    },
    statusText: { color: t.colors.textSecondary, fontSize: 12, fontWeight: '600' },
    retry: { color: t.colors.brandText, fontWeight: '800', fontSize: 13 },
  });
