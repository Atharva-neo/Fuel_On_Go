import React, { useEffect, useState } from 'react';
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

export default function BookingDetailScreen({ route, navigation }: any) {
  const { bookingId } = route.params;
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBooking();
  }, [bookingId]);

  const fetchBooking = async () => {
    try {
      const res = await api.get(`/bookings/${bookingId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBooking(res.data);
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
            await api.delete(`/bookings/${bookingId}`, {
              headers: { Authorization: `Bearer ${token}` },
              data: { refund: 0 },
            });
            fetchBooking();
            Alert.alert('Success', 'Booking cancelled successfully.');
          } catch (err) {
            Alert.alert('Error', 'Could not cancel booking.');
          }
        },
      },
    ]);
  };

  if (loading || !booking) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#00C896" />
      </View>
    );
  }

  const { pump, slot, status, qr_token } = booking;
  const isPending = status === 'pending' || status === 'confirmed';
  const isCancelled = status === 'cancelled';
  const isCompleted = status === 'completed' || status === 'arrived';
  const slotStart = new Date(slot?.start_time || `${slot?.slot_date || booking.slot_date}T${slot?.start_time || booking.slot_start}:00+05:30`);
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
    cng_amount_kg: booking.cng_amount_kg,
    booking_fee_paid: booking.booking_fee,
    remaining_amount: booking.remaining_amount || booking.pending_amount,
    fuel_payment_method: booking.fuel_payment_method,
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeftIcon size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={[styles.statusBadge, isPending ? styles.statusPending : isCancelled ? styles.statusCancelled : styles.statusCompleted]}>
            <Text style={[styles.statusText, isPending ? styles.statusTextPending : isCancelled ? styles.statusTextCancelled : styles.statusTextCompleted]}>
              {status.toUpperCase()}
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
            <LocationIcon size={16} color="#71717A" />
            <Text style={styles.pumpAddress} numberOfLines={2}>{pump?.address}</Text>
          </View>

          <View style={styles.timeBox}>
            <Text style={styles.timeLabel}>Slot Scheduled</Text>
            <Text style={styles.timeValue}>
              {(slot?.slot_date || booking.slot_date)} | {(slot?.start_time || booking.slot_start)?.slice(0, 5)} - {(slot?.end_time || booking.slot_end)?.slice(0, 5)}
            </Text>
          </View>
        </View>

        {isPending && qr_token && (
          <View style={styles.qrCard}>
            <Text style={styles.qrTitle}>Show at Station</Text>
            <View style={styles.qrCodeWrapper}>
              <QRCode value={qrData} size={220} color="#000000" backgroundColor="#FFFFFF" />
            </View>
            <Text style={styles.qrSubtitle}>Station owner will scan this to verify your booking.</Text>
          </View>
        )}

        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>Payment Summary</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Paid</Text>
            <Text style={styles.value}>₹{Number(booking.booking_fee || booking.amount_paid_now || 0).toFixed(2)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>At pump</Text>
            <Text style={styles.value}>₹{Number(booking.remaining_amount || booking.pending_amount || 0).toFixed(2)} ({booking.fuel_payment_method || 'cash'})</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>CNG booked</Text>
            <Text style={styles.value}>{Number(booking.cng_amount_kg || 0)} kg</Text>
          </View>
        </View>
        <View style={styles.countdownRow}>
          <MaterialCommunityIcons name="clock-outline" size={14} color="#71717A" />
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
          <MaterialCommunityIcons name="compass-outline" size={16} color="#fff" />
          <Text style={styles.navBtnText}>Navigate to Pump</Text>
        </TouchableOpacity>

        {isPending && (
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
            <Text style={styles.cancelText}>Cancel Booking</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  header: {
    backgroundColor: '#111111',
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
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusPending: {
    backgroundColor: 'rgba(0, 200, 150, 0.2)',
  },
  statusCancelled: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  statusCompleted: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  statusText: {
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  statusTextPending: {
    color: '#00C896',
  },
  statusTextCancelled: {
    color: '#EF4444',
  },
  statusTextCompleted: {
    color: '#3B82F6',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    marginTop: -30,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
  },
  pumpName: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0A0A0A',
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
    color: '#71717A',
    flex: 1,
  },
  timeBox: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  timeLabel: {
    fontSize: 13,
    color: '#71717A',
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
    color: '#0A0A0A',
  },
  qrCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  qrTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0A0A0A',
    marginBottom: 20,
  },
  qrCodeWrapper: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 20,
  },
  qrSubtitle: {
    fontSize: 14,
    color: '#71717A',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0A0A0A',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  label: {
    color: '#71717A',
    fontSize: 15,
  },
  value: {
    color: '#0A0A0A',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelBtn: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  navBtn: {
    backgroundColor: '#111111',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginBottom: 12,
  },
  navBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  cancelText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '700',
  },
});
