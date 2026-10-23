import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { bookingService } from '../../services/booking.service';
import { useTheme, type Theme } from '../../theme';

export default function AdminBookingDetailScreen({ route }: any) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const [booking, setBooking] = useState(route.params?.booking || null);
  const [loading, setLoading] = useState(false);

  if (!booking) {
    return (
      <View style={styles.center}>
        <Text style={styles.missing}>Booking details unavailable.</Text>
      </View>
    );
  }

  const manualCheckin = () => {
    Alert.alert('Manual check-in', 'Mark this booking as arrived?', [
      { text: 'Cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          setLoading(true);
          try {
            const res = await bookingService.checkinByAdmin(booking.qr_token || booking.id);
            setBooking({ ...booking, ...res, status: 'arrived' });
            Alert.alert('Success', 'Customer checked in.');
          } catch (error: any) {
            Alert.alert('Failed', error?.response?.data?.error || 'Unable to check in.');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Admin Booking Detail</Text>

      <View style={styles.card}>
        <Text style={styles.row}>Customer: {booking.user?.name || booking.customer_name || '-'}</Text>
        <Text style={styles.row}>Phone: {booking.user?.phone || '-'}</Text>
        <Text style={styles.row}>Vehicle: {booking.user?.vehicle_number || booking.vehicle_number || '-'}</Text>
        <Text style={styles.row}>Slot: {booking.slot_start?.slice(0, 5)} - {booking.slot_end?.slice(0, 5)}</Text>
        <Text style={styles.row}>Status: {booking.status}</Text>
        <Text style={styles.row}>Pending Collection: ?{booking.pending_amount || 0}</Text>
      </View>

      {booking.status !== 'arrived' ? (
        <TouchableOpacity style={[styles.checkinBtn, loading && styles.checkinBtnDisabled]} onPress={manualCheckin} disabled={loading}>
          <Text style={styles.checkinText}>{loading ? 'Processing...' : 'Manual Check-in'}</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.doneBadge}>
          <Text style={styles.doneText}>Already checked in</Text>
        </View>
      )}
    </View>
  );
}

const createStyles = (t: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.colors.bg,
    padding: 16,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.surface,
  },
  missing: {
    color: t.colors.textSecondary,
  },
  title: {
    color: t.colors.text,
    fontWeight: '800',
    fontSize: 24,
    marginBottom: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  row: {
    color: t.colors.textSecondary,
  },
  checkinBtn: {
    marginTop: 16,
    backgroundColor: t.colors.info,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 12,
  },
  checkinBtnDisabled: {
    opacity: 0.7,
  },
  checkinText: {
    color: t.colors.onInfo,
    fontWeight: '700',
  },
  doneBadge: {
    marginTop: 16,
    backgroundColor: t.colors.successTint,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  doneText: {
    color: t.colors.successText,
    fontWeight: '700',
  },
});
