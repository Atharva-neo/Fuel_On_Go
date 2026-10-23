import React, { useMemo, useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  PanResponder,
  Dimensions,
  TextInput,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import api from '../config/api';
import { useNavigation } from '@react-navigation/native';
import { SearchIcon, LocationIcon, ChevronRightIcon } from '../components/ui/Icons';
import { useTheme, type Theme } from '../theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_MAX_HEIGHT = SCREEN_HEIGHT * 0.8;
const SHEET_MIN_HEIGHT = SCREEN_HEIGHT * 0.3;

const HomeScreen = () => {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const navigation = useNavigation<any>();
  const [pumps, setPumps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Bottom Sheet Animation
  const panY = useRef(new Animated.Value(SCREEN_HEIGHT - SHEET_MIN_HEIGHT)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 10,
      onPanResponderMove: (_, gestureState) => {
        const currentY = (panY as any).__getValue();
        const newY = Math.max(
          SCREEN_HEIGHT - SHEET_MAX_HEIGHT,
          Math.min(SCREEN_HEIGHT - SHEET_MIN_HEIGHT, currentY + gestureState.dy)
        );
        panY.setValue(newY);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -50) {
          // Snap up
          Animated.spring(panY, {
            toValue: SCREEN_HEIGHT - SHEET_MAX_HEIGHT,
            useNativeDriver: false,
            bounciness: 0,
          }).start();
        } else if (gestureState.dy > 50) {
          // Snap down
          Animated.spring(panY, {
            toValue: SCREEN_HEIGHT - SHEET_MIN_HEIGHT,
            useNativeDriver: false,
            bounciness: 0,
          }).start();
        } else {
          // Snap back
          const closest = ((panY as any).__getValue() < SCREEN_HEIGHT - (SHEET_MAX_HEIGHT + SHEET_MIN_HEIGHT) / 2)
            ? SCREEN_HEIGHT - SHEET_MAX_HEIGHT
            : SCREEN_HEIGHT - SHEET_MIN_HEIGHT;
          Animated.spring(panY, {
            toValue: closest,
            useNativeDriver: false,
            bounciness: 0,
          }).start();
        }
        panY.extractOffset();
      },
    })
  ).current;

  useEffect(() => {
    const fetchPumps = async () => {
      try {
        const response = await api.get('/pumps/nearby', {
          params: {
            lat: 18.52,
            lng: 73.85,
            radius: 30000,
          },
        });
        setPumps(response.data);
      } catch (error) {
        console.error('Failed to fetch pumps:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPumps();
  }, []);

  const renderPump = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.pumpCard}
      activeOpacity={0.9}
      onPress={() => navigation.navigate('PumpDetail', { pumpId: item.id })}
    >
      <View style={styles.pumpHeader}>
        <View style={styles.pumpTitleRow}>
          <Text style={styles.pumpName}>{item.name}</Text>
          <View style={[styles.statusDot, { backgroundColor: t.colors.brand }]} />
        </View>
        <Text style={styles.pumpDistance}>{item.distance.toFixed(1)} km</Text>
      </View>
      <Text style={styles.pumpAddress} numberOfLines={1}>{item.address}</Text>
      
      <View style={styles.pumpFooter}>
        <View style={styles.priceTag}>
          <Text style={styles.priceText}>₹87.50/kg</Text>
        </View>
        <TouchableOpacity style={styles.bookBtn} onPress={() => navigation.navigate('PumpDetail', { pumpId: item.id })}>
          <Text style={styles.bookBtnText}>Book Slot</Text>
          <ChevronRightIcon size={16} color={t.colors.onInverse} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_DEFAULT}
        style={styles.map}
        initialRegion={{
          latitude: 18.52,
          longitude: 73.85,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
      >
        {pumps.map(pump => (
          <Marker
            key={pump.id}
            coordinate={{ latitude: pump.lat || 18.52, longitude: pump.lng || 73.85 }}
            title={pump.name}
            description={`${pump.distance.toFixed(1)} km`}
          >
            <View style={styles.markerContainer}>
              <View style={styles.markerDot} />
            </View>
          </Marker>
        ))}
      </MapView>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <LocationIcon size={20} color={t.colors.brandText} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search nearby CNG stations..."
            placeholderTextColor={t.colors.placeholder}
          />
          <SearchIcon size={20} color={t.colors.text} />
        </View>
      </View>

      <Animated.View style={[styles.bottomSheet, { top: panY }]}>
        <View style={styles.dragHandleContainer} {...panResponder.panHandlers}>
          <View style={styles.dragHandle} />
        </View>
        
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Nearby Stations</Text>
          <View style={styles.sortChip}>
            <Text style={styles.sortText}>Nearest</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={t.colors.text} />
          </View>
        ) : (
          <FlatList
            data={pumps}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderPump}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
          />
        )}
      </Animated.View>
    </View>
  );
};

const createStyles = (t: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.colors.brandTint,
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
  markerContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: t.colors.brandTint,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: t.colors.brand,
  },
  markerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: t.colors.brand,
  },
  searchContainer: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.colors.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
    shadowColor: t.colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '600',
    color: t.colors.text,
  },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -SCREEN_HEIGHT,
    height: SCREEN_HEIGHT,
    backgroundColor: t.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: t.colors.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  dragHandleContainer: {
    width: '100%',
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: t.colors.surfaceAlt,
    borderRadius: 2,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: t.colors.text,
    letterSpacing: -0.5,
  },
  sortChip: {
    backgroundColor: t.colors.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  sortText: {
    fontSize: 13,
    fontWeight: '700',
    color: t.colors.text,
  },
  listContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  pumpCard: {
    backgroundColor: t.colors.surface,
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: t.colors.border,
    shadowColor: t.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  pumpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  pumpTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pumpName: {
    fontSize: 18,
    fontWeight: '800',
    color: t.colors.text,
    letterSpacing: -0.5,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pumpDistance: {
    fontSize: 14,
    fontWeight: '700',
    color: t.colors.textSecondary,
  },
  pumpAddress: {
    fontSize: 14,
    color: t.colors.textSecondary,
    marginBottom: 16,
    fontWeight: '500',
  },
  pumpFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceTag: {
    backgroundColor: t.colors.brandTint,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  priceText: {
    color: t.colors.brandText,
    fontWeight: '800',
    fontSize: 14,
  },
  bookBtn: {
    backgroundColor: t.colors.inverse,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 4,
  },
  bookBtnText: {
    color: t.colors.onInverse,
    fontWeight: '700',
    fontSize: 14,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default HomeScreen;
