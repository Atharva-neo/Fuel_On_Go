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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import api from '../../config/api';
import { useAuthStore } from '../../store/authStore';
import { ArrowLeftIcon } from '../../components/ui/Icons';
import { format } from 'date-fns';
import SlotCarousel from '../../components/SlotCarousel';
import { useTheme, type Theme } from '../../theme';
import RatingBadge from '../../components/RatingBadge';
import { groupSlotsByPeriod, istDate, slotStartMs } from '../../utils/schedule';
import { useRatingEvents } from '../../ratings/ratingEvents';
import { useT } from '../../i18n';

export default function PumpDetailScreen({ route, navigation }: any) {
  const t = useTheme();
  const { tr, fmt } = useT();
  const styles = useMemo(() => createStyles(t), [t]);
  const { pumpId } = route.params;
  const [pump, setPump] = useState<any>(null);
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'Today' | 'Tomorrow'>('Today');
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [fuelPaymentMethod, setFuelPaymentMethod] = useState<'cash' | 'upi'>('cash');

  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);

  const ratingsVersion = useRatingEvents((s) => s.version);
  // Refetch on open and after a rating was saved, so the average/count never go stale.
  useEffect(() => {
    fetchDetails();
  }, [ratingsVersion]);

  const fetchDetails = async () => {
    try {
      const pRes = await api.get(`/pumps/${pumpId}`);
      setPump(pRes.data);
      // Same server-side list the owner sees in Manage Slots; one request per day shown in the tabs.
      const days = [istDate(0), istDate(1)];
      const lists = await Promise.all(days.map((d) => api.get(`/slots/${pumpId}`, { params: { date: d } })));
      setSlots(lists.flatMap((r) => (Array.isArray(r.data) ? r.data : [])));
    } catch (error) {
      console.error(error);
      Alert.alert(tr('common.error'), tr('pump.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleBook = (slot: any) => {
    if (!token || !user) {
      Alert.alert(tr('pump.loginRequiredTitle'), tr('pump.loginRequiredBody'), [
        { text: tr('common.cancel'), style: 'cancel' },
        { text: tr('pump.login'), onPress: () => navigation.navigate('UserAuth') },
      ]);
      return;
    }
    if (!isBookable(slot)) return;
    setSelectedSlot(slot);
    setSheetVisible(true);
  };

  const now = new Date();
  const todayStr = istDate(0);

  const isBookable = (slot: any) => {
    if (slot.status === 'deactivated' || slot.is_deactivated) return false;
    const cap = Number(slot.capacity ?? slot.max_capacity ?? 0);
    const booked = Number(slot.booked_count ?? cap - Number(slot.available_capacity ?? cap));
    if (booked >= cap) return false;
    const startMs = slotStartMs(slot.slot_date || slot.date, String(slot.start_time).slice(0, 8));
    if (Number.isFinite(startMs) && startMs < now.getTime()) return false;
    return true;
  };

  // Hooks must run unconditionally on every render — computed here, before
  // the loading/no-pump early return below, to avoid a "rendered more hooks
  // than during the previous render" crash.
  const filteredSlots = useMemo(() => {
    return slots.filter((s) => {
      const isToday = (s.slot_date || s.date) === todayStr;
      if (activeTab === 'Today') return isToday;
      return !isToday;
    }).sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
  }, [slots, activeTab, todayStr]);

  // Every hour of the day has a section (no hard-coded 6AM-10PM window); empty ones are hidden.
  const periods = useMemo(() => groupSlotsByPeriod(filteredSlots).filter((g) => g.data.length > 0), [filteredSlots]);

  const price = Number(pump?.cng_price_per_kg || 89.5);

  if (loading || !pump) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={t.colors.brandText} />
      </View>
    );
  }

  const openSlotsCount = (items: any[]) => items.filter((s) => isBookable(s)).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeftIcon size={24} color={t.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.ratingBadge}
            accessibilityRole="button"
            accessibilityLabel={tr('pump.viewReviews')}
            onPress={() => navigation.navigate('PumpReviews', { pumpId, pumpName: pump.name })}
          >
            <RatingBadge average={pump.rating_avg} count={pump.rating_count} size={13} />
            <Text style={styles.ratingText}>{tr('pump.reviews')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.pumpName}>{pump.name}</Text>
        <Text style={styles.pumpAddress}>{pump.address}</Text>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>{tr('pump.price')}</Text>
            <Text style={styles.statValueHighlight}>{tr('common.pricePerKg', { price: fmt.rupees(Number(pump.cng_price_per_kg || 87.5)) })}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>{tr('pump.status')}</Text>
            <Text style={styles.statValue}>{tr('pump.available')}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>{tr('pump.waitTime')}</Text>
            <Text style={styles.statValue}>{tr('pump.waitValue', { count: fmt.number(5) })}</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'Today' && styles.tabActive]}
            onPress={() => setActiveTab('Today')}
          >
            <Text style={[styles.tabText, activeTab === 'Today' && styles.tabTextActive]}>{tr('pump.today')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'Tomorrow' && styles.tabActive]}
            onPress={() => setActiveTab('Tomorrow')}
          >
            <Text style={[styles.tabText, activeTab === 'Tomorrow' && styles.tabTextActive]}>{tr('pump.tomorrow')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>{tr('pump.availableSlots')}</Text>
        {periods.length === 0 ? (
          <Text style={styles.empty}>{tr('pump.noSlotsDay')}</Text>
        ) : null}
        {periods.map((section) => (
          <View key={section.key} style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <MaterialCommunityIcons name={section.icon as any} size={16} color={t.colors.text} />
              <Text style={styles.sectionHeader}>
                {tr('pump.periodSlots', { label: tr(`period.${section.key}`), count: openSlotsCount(section.data) })}
              </Text>
            </View>
            {(
              <SlotCarousel
                slots={section.data}
                selectedSlotId={selectedSlot?.id}
                onSelect={(slot) => handleBook(slot)}
                onLongPress={(slot) => {
                  if ((slot.status === 'deactivated' || slot.is_deactivated) && slot.deactivation_reason) {
                    Alert.alert(tr('pump.slotUnavailable'), slot.deactivation_reason);
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
            <Text style={styles.sheetTitle}>{tr('pump.bookThisSlot')}</Text>
            {selectedSlot ? (
              <>
                <Text style={styles.sheetText}>{pump.name}</Text>
                <Text style={styles.sheetText}>
                  {tr('pump.slotLine', { start: fmt.clock(String(selectedSlot.start_time)), end: fmt.clock(String(selectedSlot.end_time)) })}
                </Text>
                <Text style={styles.sheetText}>{tr('pump.pricePerKgLine', { price: fmt.rupees(price) })}</Text>
                <Text style={[styles.sheetNote, { marginTop: 8 }]}>
                  {tr('pump.feeNote')}
                </Text>
                <Text style={[styles.sheetText, { marginTop: 8 }]}>{tr('pump.payFuelVia')}</Text>
                <View style={styles.radioRow}>
                  <TouchableOpacity onPress={() => setFuelPaymentMethod('cash')} style={styles.radioBtn}>
                    <Text>{fuelPaymentMethod === 'cash' ? '◉' : '○'} {tr('pump.cashAtPump')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setFuelPaymentMethod('upi')} style={styles.radioBtn}>
                    <Text>{fuelPaymentMethod === 'upi' ? '◉' : '○'} {tr('pump.upiAtPump')}</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={styles.confirmBtn}
                  onPress={() => {
                    setSheetVisible(false);
                    navigation.navigate('Payment', {
                      pump,
                      slot: selectedSlot,
                      fuel_payment_method: fuelPaymentMethod,
                    });
                  }}
                >
                  <Text style={styles.confirmText}>{tr('pump.confirmPay', { fee: fmt.rupees(50, 0) })}</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (t: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.colors.bg,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: t.colors.surface,
  },
  header: {
    backgroundColor: t.colors.surface,
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
    backgroundColor: t.colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: t.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: t.colors.border,
    paddingHorizontal: 12,
    minHeight: 36,
    borderRadius: 12,
  },
  ratingText: {
    color: t.colors.brandText,
    fontWeight: '800',
    fontSize: 12,
  },
  pumpName: {
    fontSize: 28,
    fontWeight: '900',
    color: t.colors.text,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  pumpAddress: {
    fontSize: 15,
    color: t.colors.textMuted,
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
    color: t.colors.textSecondary,
    fontSize: 13,
    marginBottom: 4,
    fontWeight: '600',
  },
  statValue: {
    color: t.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  statValueHighlight: {
    color: t.colors.brandText,
    fontSize: 16,
    fontWeight: '800',
  },
  content: {
    padding: 24,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: t.colors.surfaceAlt,
    borderRadius: 16,
    padding: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  tabActive: {
    backgroundColor: t.colors.surface,
    shadowColor: t.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: t.colors.textSecondary,
  },
  tabTextActive: {
    color: t.colors.text,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: t.colors.text,
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  sectionBlock: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '800',
    color: t.colors.text,
  },
  empty: {
    color: t.colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 20,
  },
  slotTile: {
    width: 90,
    height: 80,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.colors.border,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.surface,
  },
  slotAvailable: { borderColor: t.colors.brand },
  slotFull: { backgroundColor: t.colors.surfaceAlt },
  slotExpired: { backgroundColor: t.colors.surfaceAlt },
  slotDeactivated: { backgroundColor: t.colors.warningTint },
  slotMine: { backgroundColor: t.colors.info },
  tileTime: { fontWeight: '800', color: t.colors.text },
  tileMeta: { fontSize: 11, marginTop: 6, color: t.colors.textSecondary, textAlign: 'center' },
  strike: { textDecorationLine: 'line-through', color: t.colors.textMuted },
  sheetOverlay: {
    flex: 1,
    backgroundColor: t.colors.scrim,
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: t.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 32 : 20,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  sheetText: { color: t.colors.textSecondary, marginBottom: 4 },
  sheetNote: { color: t.colors.textSecondary, fontSize: 13, lineHeight: 18, marginBottom: 4 },
  radioRow: { flexDirection: 'row', gap: 10, marginVertical: 8 },
  radioBtn: { paddingVertical: 6, paddingHorizontal: 8, borderWidth: 1, borderColor: t.colors.border, borderRadius: 8 },
  confirmBtn: {
    marginTop: 12,
    backgroundColor: t.colors.brand,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmText: { color: t.colors.onBrand, fontWeight: '800' },
});
