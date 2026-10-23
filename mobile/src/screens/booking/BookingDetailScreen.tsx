import React, { useMemo, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import api from '../../config/api';
import { useAuthStore } from '../../store/authStore';
import { ArrowLeftIcon, LocationIcon } from '../../components/ui/Icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { formatDistanceToNowStrict } from 'date-fns';
import { useTheme, type Theme } from '../../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RateSheet from '../../components/RateSheet';
import { classifyBooking } from '../../utils/bookingStatus';
import { StarsDisplay } from '../../components/StarRating';
import { ratingService, type Eligibility } from '../../services/rating.service';


export default function BookingDetailScreen({ route, navigation }: any) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const { bookingId } = route.params;
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [elig, setElig] = useState<Eligibility | null>(null);
  const [eligFailed, setEligFailed] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);

  useEffect(() => {
    fetchBooking();
  }, [bookingId]);

  // Completed visit (pump operator checked the customer in): offer the rating once, prompt only the first time.
  const loadEligibility = async (b: any) => {
    if (b?.status !== 'arrived') return;
    try {
      setEligFailed(false);
      const e = await ratingService.eligibility(bookingId);
      setElig(e);
      if (e.eligible && !e.rating) {
        const key = `rating_prompted_${bookingId}`;
        const seen = await AsyncStorage.getItem(key).catch(() => null);
        if (!seen) {
          await AsyncStorage.setItem(key, '1').catch(() => {});
          setRateOpen(true);
        }
      }
    } catch {
      setEligFailed(true); // shown as a retry card below instead of hiding the option
    }
  };

  const fetchBooking = async () => {
    try {
      const res = await api.get(`/bookings/${bookingId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBooking(res.data);
      loadEligibility(res.data);
    } catch (error: any) {
      Alert.alert('Error', 'Unable to load booking details.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    Alert.alert('Cancel Booking', 'Are you sure you want to cancel?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await api.delete(`/bookings/${bookingId}`, {
              headers: { Authorization: `Bearer ${token}` },
              data: { refund: 0 },
            });
            fetchBooking();
            const t = res.data?.trust;
            const note = t && t.delta < 0
              ? `

Late cancellation: ${t.delta} trust points (score now ${t.score}).`
              : '';
            Alert.alert('Success', `Booking cancelled successfully.${note}`);
          } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.error || 'Could not cancel booking.');
          }
        },
      },
    ]);
  };

  if (loading || !booking) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={t.colors.brandText} />
      </View>
    );
  }

  const { pump, slot, status, qr_token } = booking;
  const isAwaitingApproval = status === 'pending';
  const isActive = status === 'confirmed';
  const isCancelled = status === 'cancelled' || status === 'rejected';
  const isCompleted = status === 'arrived' || status === 'no_show';
  const canCancel = isAwaitingApproval || isActive;
  const slotDateForCountdown = slot?.slot_date || booking.slot_date;
  const slotTimeForCountdown = slot?.start_time || booking.slot_start;
  const slotStart = new Date(`${slotDateForCountdown}T${slotTimeForCountdown}`);
  const countdownText = Number.isFinite(slotStart.getTime())
    ? formatDistanceToNowStrict(slotStart, { addSuffix: false })
    : '--';
  const qrData = JSON.stringify({
    booking_id: booking.id,
    qr_token: qr_token,
    user_name: user?.name,
    user_phone: user?.phone,
    vehicle_number: user?.vehicle_number,
    vehicle_type: user?.vehicle_type,
    pump_id: booking.pump_id || slot?.pump_id,
    pump_name: pump?.name,
    slot_start: slot?.start_time || booking.slot_start,
    slot_end: slot?.end_time || booking.slot_end,
    booking_fee_paid: booking.booking_fee,
    fuel_payment_method: booking.fuel_payment_method,
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeftIcon size={24} color={t.colors.text} />
          </TouchableOpacity>
          <View style={[
            styles.statusBadge,
            isAwaitingApproval ? styles.statusAmber : isActive ? styles.statusPending : isCancelled ? styles.statusCancelled : styles.statusCompleted,
          ]}>
            <Text style={[
              styles.statusText,
              isAwaitingApproval ? styles.statusTextAmber : isActive ? styles.statusTextPending : isCancelled ? styles.statusTextCancelled : styles.statusTextCompleted,
            ]}>
              {classifyBooking(booking).label.toUpperCase()}
            </Text>
          </View>
        </View>

        <Text style={styles.headerTitle}>Booking Detail</Text>
        <Text style={styles.headerSubtitle}>ID: {booking.id.slice(0, 8).toUpperCase()}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.pumpName}>{pump?.name}</Text>
          <View style={styles.locationRow}>
            <LocationIcon size={16} color={t.colors.textSecondary} />
            <Text style={styles.pumpAddress} numberOfLines={2}>{pump?.address}</Text>
          </View>

          <View style={styles.timeBox}>
            <Text style={styles.timeLabel}>Slot Scheduled</Text>
            <Text style={styles.timeValue}>
              {(slot?.slot_date || booking.slot_date)} | {(slot?.start_time || booking.slot_start)?.slice(0, 5)} - {(slot?.end_time || booking.slot_end)?.slice(0, 5)}
            </Text>
          </View>
        </View>

        {isAwaitingApproval && (
          <View style={styles.pendingNotice}>
            <MaterialCommunityIcons name="clock-alert-outline" size={18} color={t.colors.warningText} />
            <Text style={styles.pendingNoticeText}>
              Waiting for the pump owner to confirm this slot. You'll be able to check in once it's approved.
            </Text>
          </View>
        )}

        {isActive && qr_token && (
          <View style={styles.qrCard}>
            <Text style={styles.qrTitle}>Show at Station</Text>
            <View style={styles.qrCodeWrapper}>
              <QRCode value={qrData} size={220} color={t.colors.qrForeground} backgroundColor={t.colors.qrBackground} />
            </View>
            <Text style={styles.qrSubtitle}>Station owner will scan this to verify your booking.</Text>
          </View>
        )}

        {status === 'arrived' && eligFailed ? (
          <View style={styles.rateCard}>
            <Text style={styles.rateTitle}>Rate this pump</Text>
            <Text style={styles.rateSub}>We could not check your rating right now.</Text>
            <TouchableOpacity style={styles.rateBtnGhost} onPress={() => loadEligibility(booking)} accessibilityRole="button">
              <Text style={styles.rateBtnGhostText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {status === 'arrived' && elig?.eligible ? (
          <View style={styles.rateCard}>
            {elig.rating ? (
              <>
                <Text style={styles.rateTitle}>Your rating</Text>
                <StarsDisplay average={elig.rating.rating} size={22} />
                {elig.rating.review ? <Text style={styles.rateSub}>{elig.rating.review}</Text> : null}
                {elig.rating.editable ? (
                  <TouchableOpacity style={styles.rateBtnGhost} onPress={() => setRateOpen(true)} accessibilityRole="button">
                    <Text style={styles.rateBtnGhostText}>Edit rating</Text>
                  </TouchableOpacity>
                ) : null}
              </>
            ) : (
              <>
                <Text style={styles.rateTitle}>How was {pump?.name || 'your visit'}?</Text>
                <Text style={styles.rateSub}>Your visit is complete. Rating takes a few seconds and helps other drivers.</Text>
                <TouchableOpacity style={styles.rateBtn} onPress={() => setRateOpen(true)} accessibilityRole="button">
                  <Text style={styles.rateBtnText}>Rate This Pump</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : null}

        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>Payment Summary</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Paid</Text>
            <Text style={styles.value}>₹{Number(booking.booking_fee || booking.amount_paid_now || 0).toFixed(2)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Fuel payment at pump</Text>
            <Text style={styles.value}>{booking.fuel_payment_method === 'upi' ? 'UPI' : 'Cash'}</Text>
          </View>
        </View>
        <View style={styles.countdownRow}>
          <MaterialCommunityIcons name="clock-outline" size={14} color={t.colors.textSecondary} />
          <Text style={styles.timeLabel}>Starts in {countdownText}</Text>
        </View>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() =>
            navigation.navigate('Navigation', {
              lat: pump?.lat,
              lng: pump?.lng,
              pumpName: pump?.name,
              address: pump?.address,
            })
          }
        >
          <MaterialCommunityIcons name="compass-outline" size={16} color={t.colors.onInverse} />
          <Text style={styles.navBtnText}>Navigate to Pump</Text>
        </TouchableOpacity>

        {canCancel && (
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
            <Text style={styles.cancelText}>Cancel Booking</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      <RateSheet
        visible={rateOpen}
        bookingId={bookingId}
        pumpId={booking?.pump_id}
        pumpName={pump?.name || 'this pump'}
        initial={elig?.rating ? { rating: elig.rating.rating, review: elig.rating.review || '', tags: elig.rating.tags } : null}
        onClose={() => {
          setRateOpen(false);
          loadEligibility(booking);
        }}
      />
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
    backgroundColor: t.colors.surfaceAlt,
  },
  header: {
    backgroundColor: t.colors.surface,
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 40,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
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
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusPending: {
    backgroundColor: t.colors.brandTint,
  },
  statusAmber: {
    backgroundColor: t.colors.warningTint,
  },
  statusCancelled: {
    backgroundColor: t.colors.dangerTint,
  },
  statusCompleted: {
    backgroundColor: t.colors.infoTint,
  },
  statusText: {
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  statusTextPending: {
    color: t.colors.brandText,
  },
  statusTextAmber: {
    color: t.colors.warningText,
  },
  statusTextCancelled: {
    color: t.colors.dangerText,
  },
  statusTextCompleted: {
    color: t.colors.infoText,
  },
  pendingNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: t.colors.warningTint,
    borderWidth: 1,
    borderColor: t.colors.warning,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  pendingNoticeText: {
    flex: 1,
    color: t.colors.warningText,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: t.colors.text,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 15,
    color: t.colors.textMuted,
    fontWeight: '500',
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: t.colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    marginTop: -30,
    borderWidth: 1,
    borderColor: t.colors.border,
    shadowColor: t.colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
  },
  pumpName: {
    fontSize: 20,
    fontWeight: '900',
    color: t.colors.text,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  pumpAddress: {
    fontSize: 14,
    color: t.colors.textSecondary,
    flex: 1,
  },
  timeBox: {
    backgroundColor: t.colors.surfaceAlt,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  timeLabel: {
    fontSize: 13,
    color: t.colors.textSecondary,
    fontWeight: '600',
    marginBottom: 4,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  timeValue: {
    fontSize: 16,
    fontWeight: '800',
    color: t.colors.text,
  },
  rateCard: {
    backgroundColor: t.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: t.colors.border,
    padding: 18,
    marginBottom: 20,
    alignItems: 'center',
    gap: 8,
  },
  rateTitle: { color: t.colors.text, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  rateSub: { color: t.colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 18 },
  rateBtn: { alignSelf: 'stretch', backgroundColor: t.colors.brand, borderRadius: 12, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  rateBtnText: { color: t.colors.onBrand, fontWeight: '800', fontSize: 15 },
  rateBtnGhost: { minHeight: 40, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  rateBtnGhostText: { color: t.colors.brandText, fontWeight: '800' },
  qrCard: {
    backgroundColor: t.colors.surface,
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: t.colors.border,
    shadowColor: t.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  qrTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: t.colors.text,
    marginBottom: 20,
  },
  qrCodeWrapper: {
    padding: 16,
    backgroundColor: t.colors.qrBackground,
    borderRadius: 16,
    shadowColor: t.colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 20,
  },
  qrSubtitle: {
    fontSize: 14,
    color: t.colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  detailsCard: {
    backgroundColor: t.colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: t.colors.text,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  label: {
    color: t.colors.textSecondary,
    fontSize: 15,
  },
  value: {
    color: t.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  cancelBtn: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  navBtn: {
    backgroundColor: t.colors.inverse,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginBottom: 12,
  },
  navBtnText: {
    color: t.colors.onInverse,
    fontWeight: '700',
  },
  cancelText: {
    color: t.colors.dangerText,
    fontSize: 16,
    fontWeight: '700',
  },
});
