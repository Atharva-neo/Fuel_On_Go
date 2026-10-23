import React, { useMemo, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { pumpService } from '../../services/pump.service';
import { adminService } from '../../services/admin.service';
import { useTheme, type Theme } from '../../theme';


function isoDate(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function shiftDate(isoStr: string, deltaDays: number) {
  const d = new Date(`${isoStr}T00:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

export default function AdminBookingsScreen({ navigation }: any) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const [date, setDate] = useState(isoDate(0));
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await pumpService.getMyBookings(date);
      setBookings(Array.isArray(data) ? data : []);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [date]);

  const isToday = date === isoDate(0);
  const pendingCount = bookings.filter((b) => b.status === 'pending').length;

  const handleApprove = async (bookingId: string) => {
    setActingOn(bookingId);
    try {
      await adminService.approveBooking(bookingId);
      load();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Could not approve booking.');
    } finally {
      setActingOn(null);
    }
  };

  const handleReject = (bookingId: string) => {
    Alert.alert('Reject booking?', 'The slot will be freed up for other customers.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          setActingOn(bookingId);
          try {
            await adminService.rejectBooking(bookingId);
            load();
          } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.error || 'Could not reject booking.');
          } finally {
            setActingOn(null);
          }
        },
      },
    ]);
  };

  // Mirrors the server rule (slot start + 15 min grace); the server is the authority.
  const canMarkNoShow = (b: any) => {
    if (b.status !== 'confirmed' || !b.slot_date || !b.slot_start) return false;
    const hms = String(b.slot_start).length <= 5 ? `${b.slot_start}:00` : String(b.slot_start).slice(0, 8);
    const start = new Date(`${String(b.slot_date).slice(0, 10)}T${hms}+05:30`).getTime();
    return Number.isFinite(start) && Date.now() >= start + 15 * 60000;
  };

  const handleNoShow = (bookingId: string) => {
    Alert.alert(
      'Mark as no-show?',
      'Confirm the customer never arrived. This lowers their trust score and cannot be undone by you.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm no-show',
          style: 'destructive',
          onPress: async () => {
            setActingOn(bookingId);
            try {
              await adminService.markNoShow(bookingId);
              load();
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.error || 'Could not mark no-show.');
            } finally {
              setActingOn(null);
            }
          },
        },
      ]
    );
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const csv = await adminService.exportBookingsCsv();
      const file = new File(Paths.cache, `fuel-on-go-bookings-${Date.now()}.csv`);
      file.create();
      file.write(csv);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export customer scan log',
        });
      } else {
        Alert.alert('Saved', `File saved to ${file.uri}`);
      }
    } catch (err: any) {
      Alert.alert('Export failed', err?.response?.data?.error || 'Could not export bookings.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.titleWithBadge}>
            <Text style={styles.title}>Bookings</Text>
            {pendingCount > 0 ? (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>{pendingCount} pending</Text>
              </View>
            ) : null}
          </View>
          <TouchableOpacity
            style={styles.exportBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={handleExport}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator size="small" color={t.colors.brandText} />
            ) : (
              <MaterialCommunityIcons name="download-outline" size={20} color={t.colors.brandText} />
            )}
          </TouchableOpacity>
        </View>
        <View style={styles.dateRow}>
          <TouchableOpacity
            style={styles.dateBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={() => setDate(shiftDate(date, -1))}
          >
            <Text style={styles.dateAction}>Yesterday</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dateBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={() => setDate(isoDate(0))}
            disabled={isToday}
          >
            <Text style={[styles.date, isToday && styles.dateToday]}>{date}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dateBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={() => setDate(shiftDate(date, 1))}
          >
            <Text style={styles.dateAction}>Tomorrow</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={t.colors.brandText} style={{ marginTop: 24 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 24 }}>
          {bookings.map((booking) => {
            const isPending = booking.status === 'pending';
            const isNegative = booking.status === 'cancelled' || booking.status === 'rejected';
            return (
              <TouchableOpacity
                key={booking.id}
                style={[styles.card, isPending && styles.cardPending]}
                onPress={() => navigation.navigate('AdminBookingDetail', { bookingId: booking.id, booking })}
                activeOpacity={0.8}
              >
                <Text style={styles.customer}>{booking.user?.name || booking.user_name || 'Customer'}</Text>
                <Text style={styles.meta}>{booking.user?.vehicle_number || booking.vehicle_number || '-'}</Text>
                <Text style={styles.meta}>
                  {booking.slot_start?.slice(0, 5)} - {booking.slot_end?.slice(0, 5)}
                </Text>
                <View style={[styles.badge, isNegative && styles.badgeNegative, isPending && styles.badgePending]}>
                  <Text style={[styles.badgeText, isNegative && styles.badgeTextNegative, isPending && styles.badgeTextPending]}>
                    {booking.status}
                  </Text>
                </View>

                {isPending ? (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.rejectBtn}
                      disabled={actingOn === booking.id}
                      onPress={() => handleReject(booking.id)}
                    >
                      <Text style={styles.rejectBtnText}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.approveBtn}
                      disabled={actingOn === booking.id}
                      onPress={() => handleApprove(booking.id)}
                    >
                      {actingOn === booking.id ? (
                        <ActivityIndicator size="small" color={t.colors.onBrand} />
                      ) : (
                        <Text style={styles.approveBtnText}>Approve</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : null}

                {canMarkNoShow(booking) ? (
                  <TouchableOpacity
                    style={styles.noShowBtn}
                    disabled={actingOn === booking.id}
                    onPress={() => handleNoShow(booking.id)}
                  >
                    {actingOn === booking.id ? (
                      <ActivityIndicator size="small" color={t.colors.dangerText} />
                    ) : (
                      <Text style={styles.rejectBtnText}>Mark no-show</Text>
                    )}
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            );
          })}
          {bookings.length === 0 ? <Text style={styles.empty}>No bookings for selected date.</Text> : null}
        </ScrollView>
      )}
    </View>
  );
}

const createStyles = (t: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.colors.bg,
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: t.colors.bg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  title: {
    color: t.colors.text,
    fontWeight: '700',
    fontSize: 24,
  },
  pendingBadge: {
    backgroundColor: t.colors.warningTint,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pendingBadgeText: {
    color: t.colors.warningText,
    fontWeight: '700',
    fontSize: 12,
  },
  exportBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: t.colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  dateAction: {
    color: t.colors.brandText,
    fontWeight: '700',
    fontSize: 13,
  },
  date: {
    color: t.colors.textMuted,
    fontWeight: '700',
    fontSize: 13,
  },
  dateToday: {
    color: t.colors.text,
  },
  card: {
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  cardPending: {
    borderColor: t.colors.warning,
  },
  customer: {
    color: t.colors.text,
    fontWeight: '800',
    fontSize: 15,
  },
  meta: {
    color: t.colors.textMuted,
    marginTop: 4,
    fontSize: 13,
  },
  badge: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: t.colors.brandTint,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgePending: {
    backgroundColor: t.colors.warningTint,
  },
  badgeNegative: {
    backgroundColor: t.colors.dangerTint,
  },
  badgeText: {
    color: t.colors.brandText,
    fontWeight: '700',
    textTransform: 'capitalize',
    fontSize: 12,
  },
  badgeTextPending: {
    color: t.colors.warningText,
  },
  badgeTextNegative: {
    color: t.colors.dangerText,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  rejectBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: t.colors.dangerTint,
    borderWidth: 1,
    borderColor: t.colors.danger,
  },
  rejectBtnText: {
    color: t.colors.dangerText,
    fontWeight: '700',
    fontSize: 13,
  },
  noShowBtn: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: t.colors.dangerTint,
    borderWidth: 1,
    borderColor: t.colors.danger,
  },
  approveBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: t.colors.brand,
  },
  approveBtnText: {
    color: t.colors.onBrand,
    fontWeight: '700',
    fontSize: 13,
  },
  empty: {
    textAlign: 'center',
    color: t.colors.textSecondary,
    marginTop: 18,
  },
});
