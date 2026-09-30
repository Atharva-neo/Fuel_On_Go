import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { pumpService } from '../../services/pump.service';
import { adminService } from '../../services/admin.service';

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
              <ActivityIndicator size="small" color="#00C896" />
            ) : (
              <MaterialCommunityIcons name="download-outline" size={20} color="#00C896" />
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
        <ActivityIndicator color="#00C896" style={{ marginTop: 24 }} />
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
                        <ActivityIndicator size="small" color="#0A0A0A" />
                      ) : (
                        <Text style={styles.approveBtnText}>Approve</Text>
                      )}
                    </TouchableOpacity>
                  </View>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#111827',
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
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 24,
  },
  pendingBadge: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pendingBadgeText: {
    color: '#F59E0B',
    fontWeight: '700',
    fontSize: 12,
  },
  exportBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,200,150,0.12)',
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
    color: '#00C896',
    fontWeight: '700',
    fontSize: 13,
  },
  date: {
    color: '#9CA3AF',
    fontWeight: '700',
    fontSize: 13,
  },
  dateToday: {
    color: '#FFFFFF',
  },
  card: {
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  cardPending: {
    borderColor: 'rgba(245,158,11,0.4)',
  },
  customer: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  meta: {
    color: '#9CA3AF',
    marginTop: 4,
    fontSize: 13,
  },
  badge: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,200,150,0.15)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgePending: {
    backgroundColor: 'rgba(245,158,11,0.15)',
  },
  badgeNegative: {
    backgroundColor: 'rgba(239,68,68,0.15)',
  },
  badgeText: {
    color: '#00C896',
    fontWeight: '700',
    textTransform: 'capitalize',
    fontSize: 12,
  },
  badgeTextPending: {
    color: '#F59E0B',
  },
  badgeTextNegative: {
    color: '#EF4444',
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
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  rejectBtnText: {
    color: '#EF4444',
    fontWeight: '700',
    fontSize: 13,
  },
  approveBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#00C896',
  },
  approveBtnText: {
    color: '#0A0A0A',
    fontWeight: '700',
    fontSize: 13,
  },
  empty: {
    textAlign: 'center',
    color: '#6B7280',
    marginTop: 18,
  },
});
