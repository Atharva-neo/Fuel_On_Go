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
import { LocationIcon, ChevronRightIcon, CheckIcon, CalendarIcon } from '../../components/ui/Icons';

export default function AdminDashboardScreen({ navigation }: any) {
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            // RootGate watches token — clearing it automatically shows WelcomeScreen
          },
        },
      ]
    );
  };

  const [dashData, setDashData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/admin/dashboard');
      setDashData(response.data?.data || null);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Connection failed. Check your network.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDashboard(); }, []);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#00C896" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loader}>
        <Text style={styles.errorTitle}>Connection Failed</Text>
        <Text style={styles.errorMsg}>{error || 'No data available.'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchDashboard}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!dashData?.pump) {
    return (
      <View style={styles.loader}>
        <Text style={styles.errorTitle}>No pump registered yet.</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => navigation.navigate('AddPump')}>
          <Text style={styles.retryText}>+ Register Your CNG Pump</Text>
        </TouchableOpacity>
      </View>
    );
  }
  const { pump, stats } = dashData;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerGreeting}>Station Dashboard</Text>
          <TouchableOpacity
            onPress={handleLogout}
            style={styles.logoutBtn}
          >
            <Text style={styles.logoutBtnText}>Logout</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.pumpName}>{pump.name}</Text>
        <Text style={styles.pumpAddress}>{pump.address}</Text>

        <View style={styles.liveStatus}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Accepting Bookings</Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Today's Revenue</Text>
          <Text style={styles.statValue}>₹{Number(stats?.revenue_collected || 0).toFixed(2)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total Bookings</Text>
          <Text style={styles.statValueHighlight}>{Number(stats?.booked || 0)}</Text>
        </View>
      </View>
      <View style={[styles.statsGrid, { paddingTop: 0 }]}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Pending at Pump</Text>
          <Text style={styles.statValue}>₹{Number(stats?.pending_at_pump || 0).toFixed(2)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>No Shows</Text>
          <Text style={[styles.statValueHighlight, { color: '#EF4444' }]}>{Number(stats?.no_shows || 0)}</Text>
        </View>
      </View>

      <View style={styles.actionsSection}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>

        <TouchableOpacity 
          style={styles.actionCard}
          onPress={() => navigation.navigate('ScanQR')}
        >
          <View style={[styles.actionIconBox, { backgroundColor: 'rgba(0, 200, 150, 0.1)' }]}>
            <CheckIcon size={24} color="#00C896" />
          </View>
          <View style={styles.actionTextContent}>
            <Text style={styles.actionTitle}>Scan QR Code</Text>
            <Text style={styles.actionSubtitle}>Verify arriving customers</Text>
          </View>
          <ChevronRightIcon size={20} color="#71717A" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionCard}
          onPress={() => navigation.navigate('SlotManagement')}
        >
          <View style={[styles.actionIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
            <CalendarIcon size={24} color="#3B82F6" />
          </View>
          <View style={styles.actionTextContent}>
            <Text style={styles.actionTitle}>Manage Slots</Text>
            <Text style={styles.actionSubtitle}>Update capacity & timings</Text>
          </View>
          <ChevronRightIcon size={20} color="#71717A" />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    padding: 32,
  },
  errorTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMsg: {
    color: '#A1A1AA',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  retryBtn: {
    backgroundColor: '#00C896',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
  },
  retryText: {
    color: '#0A0A0A',
    fontWeight: '800',
    fontSize: 16,
  },
  content: {
    paddingBottom: 40,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 32,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerGreeting: {
    fontSize: 16,
    color: '#A1A1AA',
    fontWeight: '600',
  },
  logoutBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(239,68,68,0.15)',
  },
  logoutBtnText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
  },
  pumpName: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1,
    marginBottom: 8,
  },
  pumpAddress: {
    fontSize: 15,
    color: '#A1A1AA',
    marginBottom: 20,
    lineHeight: 22,
  },
  liveStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 200, 150, 0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00C896',
  },
  liveText: {
    color: '#00C896',
    fontWeight: '700',
    fontSize: 13,
  },
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#111111',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statLabel: {
    color: '#71717A',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
  },
  statValueHighlight: {
    color: '#00C896',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
  },
  actionsSection: {
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111111',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  actionIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTextContent: {
    flex: 1,
    marginLeft: 16,
  },
  actionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  actionSubtitle: {
    color: '#A1A1AA',
    fontSize: 14,
    fontWeight: '500',
  },
});
