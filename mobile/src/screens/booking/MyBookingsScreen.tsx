import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import api from '../../config/api';
import { useAuthStore } from '../../store/authStore';
import { ChevronRightIcon, CalendarIcon } from '../../components/ui/Icons';

type TabType = 'pending' | 'completed' | 'cancelled';

export default function MyBookingsScreen({ navigation }: any) {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const res = await api.get('/bookings/my-bookings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBookings(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredBookings = bookings.filter((b) => b.status === activeTab);

  const renderBooking = ({ item }: { item: any }) => {
    const isPending = item.status === 'pending';
    const isCancelled = item.status === 'cancelled';
    const isCompleted = item.status === 'completed';

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('BookingDetail', { bookingId: item.id })}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.pumpName} numberOfLines={1}>{item.pump.name}</Text>
          <View style={[styles.statusBadge, isPending ? styles.statusPending : isCancelled ? styles.statusCancelled : styles.statusCompleted]}>
            <Text style={[styles.statusText, isPending ? styles.statusTextPending : isCancelled ? styles.statusTextCancelled : styles.statusTextCompleted]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.timeText}>{item.slot.date} | {item.slot.start_time.slice(0, 5)}</Text>
          <Text style={styles.priceText}>Fee: ₹10.00</Text>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.viewDetailsText}>View Details</Text>
          <ChevronRightIcon size={16} color="#00C896" />
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#0A0A0A" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Bookings</Text>
      </View>

      <View style={styles.tabsContainer}>
        {(['pending', 'completed', 'cancelled'] as TabType[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {filteredBookings.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <CalendarIcon size={32} color="#A1A1AA" />
          </View>
          <Text style={styles.emptyTitle}>No Bookings Found</Text>
          <Text style={styles.emptySubtitle}>You have no {activeTab} bookings at the moment.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredBookings}
          keyExtractor={(item) => item.id}
          renderItem={renderBooking}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
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
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0A0A0A',
    letterSpacing: -1,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  tabActive: {
    backgroundColor: '#0A0A0A',
    borderColor: '#0A0A0A',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#71717A',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  pumpName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0A0A0A',
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusPending: {
    backgroundColor: 'rgba(0, 200, 150, 0.15)',
  },
  statusCancelled: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  statusCompleted: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
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
  cardBody: {
    marginBottom: 16,
  },
  timeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#71717A',
    marginBottom: 4,
  },
  priceText: {
    fontSize: 14,
    color: '#A1A1AA',
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingTop: 16,
  },
  viewDetailsText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#00C896',
    marginRight: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F4F4F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0A0A0A',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#71717A',
    textAlign: 'center',
    lineHeight: 22,
  },
});
