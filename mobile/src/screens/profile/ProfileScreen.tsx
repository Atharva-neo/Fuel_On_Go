import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { CheckIcon, ChevronRightIcon, InfoIcon } from '../../components/ui/Icons';
import api from '../../config/api';

export default function ProfileScreen({ navigation }: any) {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const [prefOpen, setPrefOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [stats, setStats] = useState({
    total_bookings: 0,
    trust_score: 100,
    no_show_count: 0,
    arrived_count: 0,
    cancelled_count: 0,
    is_blocked: false,
  });

  React.useEffect(() => {
    const load = async () => {
      setStatsLoading(true);
      try {
        const res = await api.get('/users/stats', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setStats({
          total_bookings: Number(res.data?.total_bookings || 0),
          trust_score: Number(res.data?.trust_score ?? 100),
          no_show_count: Number(res.data?.no_show_count || 0),
          arrived_count: Number(res.data?.arrived_count || 0),
          cancelled_count: Number(res.data?.cancelled_count || 0),
          is_blocked: !!res.data?.is_blocked,
        });
      } catch {
        setStats({
          total_bookings: 0,
          trust_score: 100,
          no_show_count: 0,
          arrived_count: 0,
          cancelled_count: 0,
          is_blocked: false,
        });
      } finally {
        setStatsLoading(false);
      }
    };
    load();
  }, [token]);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => {
          // RootGate watches token — clearing it automatically shows WelcomeScreen
          await logout();
        } 
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarInitial}>{user?.name?.charAt(0)?.toUpperCase() || 'U'}</Text>
        </View>
        <Text style={styles.name}>{user?.name || 'User'}</Text>
        <Text style={styles.phone}>{user?.phone || '+91 00000 00000'}</Text>

        <View style={styles.trustBadge}>
          <CheckIcon size={14} color="#00C896" />
          <Text style={styles.trustText}>Verified Profile</Text>
        </View>
      </View>

      {statsLoading ? (
        <View style={styles.statsLoader}>
          <ActivityIndicator color="#00C896" />
        </View>
      ) : (
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.total_bookings}</Text>
            <Text style={styles.statLabel}>Total Bookings</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValueHighlight}>{stats.trust_score}</Text>
            <Text style={styles.statLabel}>Trust Score</Text>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Settings</Text>
        
        <TouchableOpacity style={styles.menuItem} onPress={() => setPrefOpen(true)}>
          <View style={styles.menuItemLeft}>
            <View style={[styles.menuIconBox, { backgroundColor: 'rgba(0, 200, 150, 0.1)' }]}>
              <InfoIcon size={18} color="#00C896" />
            </View>
            <Text style={styles.menuItemText}>Preferences</Text>
          </View>
          <ChevronRightIcon size={16} color="#A1A1AA" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => setHelpOpen(true)}>
          <View style={styles.menuItemLeft}>
            <View style={[styles.menuIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
              <InfoIcon size={18} color="#3B82F6" />
            </View>
            <Text style={styles.menuItemText}>Help & Support</Text>
          </View>
          <ChevronRightIcon size={16} color="#A1A1AA" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

      {/* Preferences Modal */}
      <Modal visible={prefOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Preferences</Text>
            
            <View style={styles.prefRow}>
              <Text style={styles.prefLabel}>Push Notifications</Text>
              <Switch value={true} trackColor={{ true: '#00C896', false: '#E5E7EB' }} />
            </View>
            <View style={styles.prefRow}>
              <Text style={styles.prefLabel}>SMS Alerts</Text>
              <Switch value={false} trackColor={{ true: '#00C896', false: '#E5E7EB' }} />
            </View>

            <TouchableOpacity style={styles.modalBtn} onPress={() => setPrefOpen(false)}>
              <Text style={styles.modalBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Help Modal */}
      <Modal visible={helpOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Help & Support</Text>
            <Text style={styles.helpText}>Call us at: +91 800-000-0000</Text>
            <Text style={styles.helpSub}>Available 9 AM to 6 PM</Text>
            
            <TouchableOpacity style={styles.modalBtn} onPress={() => setHelpOpen(false)}>
              <Text style={styles.modalBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  content: {
    paddingBottom: 40,
  },
  header: {
    backgroundColor: '#111111',
    alignItems: 'center',
    paddingTop: 80,
    paddingBottom: 40,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#00C896',
  },
  avatarInitial: {
    color: '#00C896',
    fontSize: 32,
    fontWeight: '900',
  },
  name: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  phone: {
    color: '#A1A1AA',
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 16,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 200, 150, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 200, 150, 0.2)',
  },
  trustText: {
    color: '#00C896',
    fontWeight: '700',
    fontSize: 13,
  },
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 16,
    marginTop: -20,
    marginBottom: 32,
  },
  statsLoader: {
    marginTop: -20,
    marginBottom: 32,
    alignItems: 'center',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0A0A0A',
    marginBottom: 4,
  },
  statValueHighlight: {
    fontSize: 24,
    fontWeight: '900',
    color: '#00C896',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#71717A',
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0A0A0A',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0A0A0A',
  },
  logoutBtn: {
    marginHorizontal: 24,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0A0A0A',
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  prefRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  prefLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0A0A0A',
  },
  modalBtn: {
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 12,
  },
  modalBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  helpText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A0A0A',
    marginBottom: 4,
  },
  helpSub: {
    fontSize: 14,
    color: '#71717A',
    marginBottom: 24,
  },
});
