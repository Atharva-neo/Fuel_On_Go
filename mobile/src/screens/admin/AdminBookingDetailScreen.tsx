import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { bookingService } from '../../services/booking.service';
import { apiErrorMessage } from '../../i18n/errors';
import { useTheme, type Theme } from '../../theme';
import { useT } from '../../i18n';

export default function AdminBookingDetailScreen({ route }: any) {
  const t = useTheme();
  const { tr, fmt } = useT();
  const styles = useMemo(() => createStyles(t), [t]);
  const [booking, setBooking] = useState(route.params?.booking || null);
  const [loading, setLoading] = useState(false);

  if (!booking) {
    return (
      <View style={styles.center}>
        <Text style={styles.missing}>{tr('ownerDetail.unavailable')}</Text>
      </View>
    );
  }

  const manualCheckin = () => {
    Alert.alert(tr('ownerDetail.manualTitle'), tr('ownerDetail.manualBody'), [
      { text: tr('common.cancel') },
      {
        text: tr('common.confirm'),
        onPress: async () => {
          setLoading(true);
          try {
            const res = await bookingService.checkinByAdmin(booking.qr_token || booking.id);
            setBooking({ ...booking, ...res, status: 'arrived' });
            Alert.alert(tr('common.success'), tr('ownerDetail.checkedIn'));
          } catch (error: any) {
            Alert.alert(tr('ownerDetail.failed'), apiErrorMessage(error, tr, 'ownerDetail.checkinFailed'));
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{tr('ownerDetail.title')}</Text>

      <View style={styles.card}>
        <Text style={styles.row}>{tr('ownerDetail.customer', { value: booking.user?.name || booking.customer_name || '-' })}</Text>
        <Text style={styles.row}>{tr('ownerDetail.phone', { value: booking.user?.phone || '-' })}</Text>
        <Text style={styles.row}>{tr('ownerDetail.vehicle', { value: booking.user?.vehicle_number || booking.vehicle_number || '-' })}</Text>
        <Text style={styles.row}>{tr('ownerDetail.slot', { start: fmt.clock(String(booking.slot_start)), end: fmt.clock(String(booking.slot_end)) })}</Text>
        <Text style={styles.row}>{tr('ownerDetail.status', { value: ['pending', 'confirmed', 'arrived', 'no_show', 'cancelled', 'rejected'].includes(booking.status) ? tr(`status.${booking.status}`) : booking.status })}</Text>
        <Text style={styles.row}>{tr('ownerDetail.pendingCollection', { amount: fmt.rupees(Number(booking.pending_amount || 0), 0) })}</Text>
      </View>

      {booking.status !== 'arrived' ? (
        <TouchableOpacity style={[styles.checkinBtn, loading && styles.checkinBtnDisabled]} onPress={manualCheckin} disabled={loading}>
          <Text style={styles.checkinText}>{loading ? tr('payment.processing') : tr('ownerDetail.manualCheckin')}</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.doneBadge}>
          <Text style={styles.doneText}>{tr('ownerDetail.alreadyCheckedIn')}</Text>
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
