import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import api from '../config/api';

type Booking = {
  id: number | string;
  customer_name: string;
  vehicle_number: string;
  slot_time: string;
  status: string;
};

const AdminBookingsScreen = ({ navigation }: { navigation: any }) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const response = await api.get('/pumps/my-bookings', { params: { date: new Date().toISOString().split('T')[0] } });
        setBookings(response.data);
      } catch (error) {
        console.error('Error fetching bookings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, []);

  const renderBooking = ({ item }: { item: Booking }) => (
    <TouchableOpacity
      style={styles.bookingCard}
      onPress={() => navigation.navigate('AdminBookingDetail', { bookingId: item.id })}
    >
      <Text style={styles.bookingText}>Customer: {item.customer_name}</Text>
      <Text style={styles.bookingText}>Vehicle: {item.vehicle_number}</Text>
      <Text style={styles.bookingText}>Slot: {item.slot_time}</Text>
      <Text style={styles.bookingText}>Status: {item.status}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return <Text>Loading bookings...</Text>;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderBooking}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 10,
  },
  listContainer: {
    paddingBottom: 20,
  },
  bookingCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  bookingText: {
    fontSize: 16,
    marginBottom: 5,
  },
});

export default AdminBookingsScreen;