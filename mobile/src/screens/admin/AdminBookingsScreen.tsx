import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { pumpService } from '../../services/pump.service';

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Bookings</Text>
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
          {bookings.map((booking) => (
            <TouchableOpacity
              key={booking.id}
              style={styles.card}
              onPress={() => navigation.navigate('AdminBookingDetail', { bookingId: booking.id, booking })}
            >
              <Text style={styles.customer}>{booking.user?.name || booking.user_name || 'Customer'}</Text>
              <Text style={styles.meta}>{booking.user?.vehicle_number || booking.vehicle_number || '-'}</Text>
              <Text style={styles.meta}>
                {booking.slot_start?.slice(0, 5)} - {booking.slot_end?.slice(0, 5)}
              </Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{booking.status}</Text>
              </View>
            </TouchableOpacity>
          ))}
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
  title: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 24,
    marginBottom: 12,
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
  badgeText: {
    color: '#00C896',
    fontWeight: '700',
    textTransform: 'capitalize',
    fontSize: 12,
  },
  empty: {
    textAlign: 'center',
    color: '#6B7280',
    marginTop: 18,
  },
});
