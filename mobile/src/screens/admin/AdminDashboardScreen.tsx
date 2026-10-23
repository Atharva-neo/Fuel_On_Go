import React, { useMemo, useEffect, useState } from 'react';
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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ThemeToggle from '../../components/ThemeToggle';
import { useTheme, type Theme } from '../../theme';

export default function AdminDashboardScreen({ navigation }: any) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
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
        <ActivityIndicator size="large" color={t.colors.brandText} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loader}>
        <ThemeToggle style={{ position: 'absolute', top: 52, right: 20 }} />
        <Text style={styles.errorTitle}>Connection Failed</Text>
        <Text style={styles.errorMsg}>{error || 'No data available.'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchDashboard}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleLogout}
          style={[styles.retryBtn, { backgroundColor: t.colors.dangerTint, marginTop: 16 }]}
        >
          <Text style={[styles.retryText, { color: t.colors.dangerText }]}>Logout</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!dashData?.pump) {
    return (
      <View style={styles.loader}>
        <ThemeToggle style={{ position: 'absolute', top: 52, right: 20 }} />
        <TouchableOpacity
          onPress={handleLogout}
          style={[styles.retryBtn, { backgroundColor: t.colors.dangerTint, marginBottom: 32 }]}
        >
          <Text style={[styles.retryText, { color: t.colors.dangerText }]}>Logout</Text>
        </TouchableOpacity>
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
          <ThemeToggle size={20} style={{ marginLeft: 'auto', marginRight: 10, width: 40, height: 40 }} />
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
        <View style={styles.statCardFull}>
          <Text style={styles.statLabel}>Today's Revenue</Text>
          <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
            ₹{Number(stats?.revenue_collected || 0).toFixed(2)}
          </Text>
        </View>
      </View>
      <View style={[styles.statsGrid, { paddingTop: 0 }]}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total Bookings</Text>
          <Text style={styles.statValueHighlight}>{Number(stats?.booked || 0)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>No Shows</Text>
          <Text style={[styles.statValueHighlight, { color: t.colors.dangerText }]}>{Number(stats?.no_shows || 0)}</Text>
        </View>
      </View>

      <View style={styles.actionsSection}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>

        <TouchableOpacity 
          style={styles.actionCard}
          onPress={() => navigation.navigate('ScanQR')}
        >
          <View style={[styles.actionIconBox, { backgroundColor: t.colors.brandTint }]}>
            <CheckIcon size={24} color={t.colors.brandText} />
          </View>
          <View style={styles.actionTextContent}>
            <Text style={styles.actionTitle}>Scan QR Code</Text>
            <Text style={styles.actionSubtitle}>Verify arriving customers</Text>
          </View>
          <ChevronRightIcon size={20} color={t.colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('OwnerFeedback')}
          accessibilityRole="button"
        >
          <View style={[styles.actionIconBox, { backgroundColor: t.colors.warningTint }]}>
            <MaterialCommunityIcons name="star-outline" size={24} color={t.colors.warningText} />
          </View>
          <View style={styles.actionTextContent}>
            <Text style={styles.actionTitle}>Customer Feedback</Text>
            <Text style={styles.actionSubtitle}>Ratings and reviews for your pump</Text>
          </View>
          <ChevronRightIcon size={20} color={t.colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionCard}
          onPress={() => navigation.navigate('SlotManagement')}
        >
          <View style={[styles.actionIconBox, { backgroundColor: t.colors.infoTint }]}>
            <CalendarIcon size={24} color={t.colors.infoText} />
          </View>
          <View style={styles.actionTextContent}>
            <Text style={styles.actionTitle}>Manage Slots</Text>
            <Text style={styles.actionSubtitle}>Update capacity & timings</Text>
          </View>
          <ChevronRightIcon size={20} color={t.colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('CngUpdate')}
        >
          <View style={[styles.actionIconBox, { backgroundColor: t.colors.warningTint }]}>
            <MaterialCommunityIcons name="pencil-outline" size={24} color={t.colors.warningText} />
          </View>
          <View style={styles.actionTextContent}>
            <Text style={styles.actionTitle}>Edit Pump Details</Text>
            <Text style={styles.actionSubtitle}>Name, rate, timings, address & more</Text>
          </View>
          <ChevronRightIcon size={20} color={t.colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const createStyles = (t: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.colors.bg,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: t.colors.bg,
    padding: 32,
  },
  errorTitle: {
    color: t.colors.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMsg: {
    color: t.colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  retryBtn: {
    backgroundColor: t.colors.brand,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
  },
  retryText: {
    color: t.colors.text,
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
    borderBottomColor: t.colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerGreeting: {
    fontSize: 16,
    color: t.colors.textMuted,
    fontWeight: '600',
  },
  logoutBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: t.colors.dangerTint,
  },
  logoutBtnText: {
    color: t.colors.dangerText,
    fontSize: 13,
    fontWeight: '700',
  },
  pumpName: {
    fontSize: 32,
    fontWeight: '900',
    color: t.colors.text,
    letterSpacing: -1,
    marginBottom: 8,
  },
  pumpAddress: {
    fontSize: 15,
    color: t.colors.textMuted,
    marginBottom: 20,
    lineHeight: 22,
  },
  liveStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.colors.brandTint,
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
    backgroundColor: t.colors.brand,
  },
  liveText: {
    color: t.colors.brandText,
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
    backgroundColor: t.colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  statCardFull: {
    flex: 1,
    backgroundColor: t.colors.surface,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  statLabel: {
    color: t.colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  statValue: {
    color: t.colors.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
  },
  statValueHighlight: {
    color: t.colors.brandText,
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
    color: t.colors.text,
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.colors.surface,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: t.colors.border,
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
    color: t.colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  actionSubtitle: {
    color: t.colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
});
