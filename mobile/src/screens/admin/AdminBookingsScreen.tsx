import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { pumpService } from '../../services/pump.service';

function isoDate(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Bookings</Text>
        <View style={styles.dateRow}>
          <TouchableOpacity onPress={() => setDate(isoDate(-1))}>
            <Text style={styles.dateAction}>Yesterday</Text>
          </TouchableOpacity>
          <Text style={styles.date}>{date}</Text>
          <TouchableOpacity onPress={() => setDate(isoDate(1))}>
            <Text style={styles.dateAction}>Tomorrow</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color="#0ea5e9" style={{ marginTop: 24 }} />
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
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 24,
    marginBottom: 8,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateAction: {
    color: '#0284c7',
    fontWeight: '700',
    fontSize: 12,
  },
  date: {
    color: '#0f172a',
    fontWeight: '700',
  },
  card: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  customer: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 15,
  },
  meta: {
    color: '#64748b',
    marginTop: 4,
  },
  badge: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#e0f2fe',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    color: '#0369a1',
    fontWeight: '700',
    textTransform: 'capitalize',
    fontSize: 12,
  },
  empty: {
    textAlign: 'center',
    color: '#94a3b8',
    marginTop: 18,
  },
});
