import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import api from '../../config/api';
import { useAuthStore } from '../../store/authStore';
import { ArrowLeftIcon } from '../../components/ui/Icons';
import { format } from 'date-fns';
import SlotCarousel from '../../components/SlotCarousel';

export default function PumpDetailScreen({ route, navigation }: any) {
  const { pumpId } = route.params;
  const [pump, setPump] = useState<any>(null);
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'Today' | 'Tomorrow'>('Today');
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [cngAmount, setCngAmount] = useState(8);
  const [fuelPaymentMethod, setFuelPaymentMethod] = useState<'cash' | 'upi'>('cash');
  
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    fetchDetails();
  }, []);

  const fetchDetails = async () => {
    try {
      const pRes = await api.get(`/pumps/${pumpId}`);
      setPump(pRes.data);
      const sRes = await api.get(`/slots/${pumpId}`);
      setSlots(Array.isArray(sRes.data) ? sRes.data : []);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Unable to load details.');
    } finally {
      setLoading(false);
    }
  };

  const handleBook = (slot: any) => {
    if (!token || !user) {
      Alert.alert('Login Required', 'Please login to book a slot.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Login', onPress: () => navigation.navigate('UserAuth') },
      ]);
      return;
    }
    if (!isBookable(slot)) return;
    setSelectedSlot(slot);
    setSheetVisible(true);
  };

  if (loading || !pump) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#00C896" />
      </View>
    );
  }

  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');

  const filteredSlots = slots.filter((s) => {
    const isToday = (s.slot_date || s.date) === todayStr;
    if (activeTab === 'Today') return isToday;
    return !isToday;
  }).sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));

  const isBookable = (slot: any) => {
    if (slot.status === 'deactivated' || slot.is_deactivated) return false;
    const cap = Number(slot.capacity ?? slot.max_capacity ?? 0);
    const booked = Number(slot.booked_count ?? cap - Number(slot.available_capacity ?? cap));
    if (booked >= cap) return false;
    const slotStart = new Date(`${slot.slot_date || slot.date}T${slot.start_time}`);
    if (Number.isFinite(slotStart.getTime()) && slotStart.getTime() < now.getTime()) return false;
    return true;
  };

  const bySection = useMemo(() => {
    const groups = {
      morning: [] as any[],
      afternoon: [] as any[],
      evening: [] as any[],
    };
    filteredSlots.forEach((s) => {
      const hour = Number(String(s.start_time).slice(0, 2));
      if (hour >= 6 && hour < 12) groups.morning.push(s);
      else if (hour >= 12 && hour < 18) groups.afternoon.push(s);
      else if (hour >= 18 && hour <= 22) groups.evening.push(s);
    });
    return groups;
  }, [filteredSlots]);

  const calc = useMemo(() => {
    const price = Number(pump?.cng_price_per_kg || 89.5);
    const total = cngAmount * price;
    const fee = Number((total * 0.1).toFixed(2));
    const remaining = Number((total - fee).toFixed(2));
    return { price, total, fee, remaining };
  }, [cngAmount, pump?.cng_price_per_kg]);

  const openSlotsCount = (items: any[]) => items.filter((s) => isBookable(s)).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeftIcon size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingText}>{pump.google_rating || '4.5'} ★</Text>
          </View>
        </View>

        <Text style={styles.pumpName}>{pump.name}</Text>
        <Text style={styles.pumpAddress}>{pump.address}</Text>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Price</Text>
            <Text style={styles.statValueHighlight}>₹{pump.cng_price_per_kg || '87.50'}/kg</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Status</Text>
            <Text style={styles.statValue}>Available</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Wait Time</Text>
            <Text style={styles.statValue}>~5 mins</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'Today' && styles.tabActive]}
            onPress={() => setActiveTab('Today')}
          >
            <Text style={[styles.tabText, activeTab === 'Today' && styles.tabTextActive]}>Today</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'Tomorrow' && styles.tabActive]}
            onPress={() => setActiveTab('Tomorrow')}
          >
            <Text style={[styles.tabText, activeTab === 'Tomorrow' && styles.tabTextActive]}>Tomorrow</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Available Slots</Text>
        {[
          { key: 'morning', label: '🌅 Morning', range: '(6AM - 12PM)', data: bySection.morning },
          { key: 'afternoon', label: '☀️ Afternoon', range: '(12PM - 6PM)', data: bySection.afternoon },
          { key: 'evening', label: '🌙 Evening', range: '(6PM - 10PM)', data: bySection.evening },
        ].map((section) => (
          <View key={section.key} style={styles.sectionBlock}>
            <Text style={styles.sectionHeader}>
              {section.label} · {openSlotsCount(section.data)} slots available
            </Text>
            {section.data.length === 0 ? (
              <Text style={styles.empty}>No {section.key} slots available</Text>
            ) : (
              <SlotCarousel
                slots={section.data}
                selectedSlotId={selectedSlot?.id}
                onSelect={(slot) => handleBook(slot)}
                onLongPress={(slot) => {
                  if ((slot.status === 'deactivated' || slot.is_deactivated) && slot.deactivation_reason) {
                    Alert.alert('Slot unavailable', slot.deactivation_reason);
                  }
                }}
              />
            )}
          </View>
        ))}
      </ScrollView>
      <Modal visible={sheetVisible} transparent animationType="slide" onRequestClose={() => setSheetVisible(false)}>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheetCard}>
            <Text style={styles.sheetTitle}>Book This Slot</Text>
            {selectedSlot ? (
              <>
                <Text style={styles.sheetText}>{pump.name}</Text>
                <Text style={styles.sheetText}>
                  Slot: {String(selectedSlot.start_time).slice(0, 5)} - {String(selectedSlot.end_time).slice(0, 5)}
                </Text>
                <Text style={styles.sheetText}>Price per kg: ₹{calc.price.toFixed(2)}</Text>
                <Text style={[styles.sheetText, { marginTop: 8 }]}>How much CNG do you want?</Text>
                <Slider
                  minimumValue={1}
                  maximumValue={20}
                  step={1}
                  value={cngAmount}
                  onValueChange={(v) => setCngAmount(v)}
                  minimumTrackTintColor="#00C896"
                  maximumTrackTintColor="#E5E7EB"
                  thumbTintColor="#00C896"
                />
                <Text style={styles.sheetText}>Currently selected: {cngAmount} kg</Text>
                <Text style={styles.sheetText}>Estimated cost: ₹{calc.total.toFixed(2)}</Text>
                <Text style={styles.sheetText}>Booking fee (10%): ₹{calc.fee.toFixed(2)}</Text>
                <Text style={styles.sheetText}>Remaining at pump: ₹{calc.remaining.toFixed(2)}</Text>
                <Text style={[styles.sheetText, { marginTop: 8 }]}>Pay remaining at pump via:</Text>
                <View style={styles.radioRow}>
                  <TouchableOpacity onPress={() => setFuelPaymentMethod('cash')} style={styles.radioBtn}>
                    <Text>{fuelPaymentMethod === 'cash' ? '◉' : '○'} Cash at pump</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setFuelPaymentMethod('upi')} style={styles.radioBtn}>
                    <Text>{fuelPaymentMethod === 'upi' ? '◉' : '○'} UPI at pump</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={styles.confirmBtn}
                  onPress={() => {
                    setSheetVisible(false);
                    navigation.navigate('Payment', {
                      pump,
                      slot: selectedSlot,
                      cng_amount_kg: cngAmount,
                      booking_fee: calc.fee,
                      total_estimated: calc.total,
                      remaining_amount: calc.remaining,
                      fuel_payment_method: fuelPaymentMethod,
                    });
                  }}
                >
                  <Text style={styles.confirmText}>Confirm & Pay ₹{calc.fee.toFixed(2)}</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  header: {
    backgroundColor: '#111111',
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 32,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingBadge: {
    backgroundColor: '#00C896',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  ratingText: {
    color: '#0A0A0A',
    fontWeight: '800',
    fontSize: 14,
  },
  pumpName: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  pumpAddress: {
    fontSize: 15,
    color: '#A1A1AA',
    marginBottom: 24,
    lineHeight: 22,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    flex: 1,
  },
  statLabel: {
    color: '#71717A',
    fontSize: 13,
    marginBottom: 4,
    fontWeight: '600',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  statValueHighlight: {
    color: '#00C896',
    fontSize: 16,
    fontWeight: '800',
  },
  content: {
    padding: 24,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    padding: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#71717A',
  },
  tabTextActive: {
    color: '#0A0A0A',
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0A0A0A',
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  sectionBlock: {
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0A0A0A',
    marginBottom: 10,
  },
  empty: {
    color: '#A1A1AA',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 20,
  },
  slotTile: {
    width: 90,
    height: 80,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  slotAvailable: { borderColor: '#00C896' },
  slotFull: { backgroundColor: '#F4F4F5' },
  slotExpired: { backgroundColor: '#F8FAFC' },
  slotDeactivated: { backgroundColor: '#FED7AA' },
  slotMine: { backgroundColor: '#0D9488' },
  tileTime: { fontWeight: '800', color: '#0A0A0A' },
  tileMeta: { fontSize: 11, marginTop: 6, color: '#475569', textAlign: 'center' },
  strike: { textDecorationLine: 'line-through', color: '#9CA3AF' },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 32 : 20,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  sheetText: { color: '#334155', marginBottom: 4 },
  radioRow: { flexDirection: 'row', gap: 10, marginVertical: 8 },
  radioBtn: { paddingVertical: 6, paddingHorizontal: 8, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8 },
  confirmBtn: {
    marginTop: 12,
    backgroundColor: '#00C896',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmText: { color: '#0A0A0A', fontWeight: '800' },
});
