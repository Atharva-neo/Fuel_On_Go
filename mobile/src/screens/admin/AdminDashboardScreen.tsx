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
import OverflowMenu from '../../components/OverflowMenu';
import { apiErrorMessage } from '../../i18n/errors';
import { useTheme, type Theme } from '../../theme';
import { useT } from '../../i18n';

export default function AdminDashboardScreen({ navigation }: any) {
  const t = useTheme();
  const { tr, fmt } = useT();
  const styles = useMemo(() => createStyles(t), [t]);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    Alert.alert(
      tr('menu.logoutTitle'),
      tr('menu.logoutBody'),
      [
        { text: tr('common.cancel'), style: 'cancel' },
        {
          text: tr('menu.logout'),
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
      setError(apiErrorMessage(err, tr, 'dash.connectionHint'));
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
        <OverflowMenu style={{ position: 'absolute', top: 52, right: 20 }} offsetTop={60} />
        <Text style={styles.errorTitle}>{tr('dash.connectionFailed')}</Text>
        <Text style={styles.errorMsg}>{error || tr('dash.noData')}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchDashboard}>
          <Text style={styles.retryText}>{tr('common.retry')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleLogout}
          style={[styles.retryBtn, { backgroundColor: t.colors.dangerTint, marginTop: 16 }]}
        >
          <Text style={[styles.retryText, { color: t.colors.dangerText }]}>{tr('menu.logout')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!dashData?.pump) {
    return (
      <View style={styles.loader}>
        <OverflowMenu style={{ position: 'absolute', top: 52, right: 20 }} offsetTop={60} />
        <TouchableOpacity
          onPress={handleLogout}
          style={[styles.retryBtn, { backgroundColor: t.colors.dangerTint, marginBottom: 32 }]}
        >
          <Text style={[styles.retryText, { color: t.colors.dangerText }]}>{tr('menu.logout')}</Text>
        </TouchableOpacity>
        <Text style={styles.errorTitle}>{tr('dash.noPump')}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => navigation.navigate('AddPump')}>
          <Text style={styles.retryText}>{tr('dash.registerPump')}</Text>
        </TouchableOpacity>
      </View>
    );
  }
  const { pump, stats } = dashData;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerGreeting} numberOfLines={1}>{tr('dash.title')}</Text>
          <OverflowMenu style={{ marginLeft: 'auto' }} offsetTop={70} />
        </View>

        <Text style={styles.pumpName}>{pump.name}</Text>
        <Text style={styles.pumpAddress}>{pump.address}</Text>

        <View style={styles.liveStatus}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>{tr('dash.accepting')}</Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCardFull}>
          <Text style={styles.statLabel}>{tr('dash.todaysRevenue')}</Text>
          <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
            {fmt.rupees(Number(stats?.revenue_collected || 0))}
          </Text>
        </View>
      </View>
      <View style={[styles.statsGrid, { paddingTop: 0 }]}>
        <View style={styles.statCard}>
          <Text style={[styles.statLabel, styles.statLabelTwoLine]} numberOfLines={2}>{tr('dash.totalBookings')}</Text>
          <Text style={styles.statValueHighlight}>{Number(stats?.booked || 0)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statLabel, styles.statLabelTwoLine]} numberOfLines={2}>{tr('dash.noShows')}</Text>
          <Text style={[styles.statValueHighlight, { color: t.colors.dangerText }]}>{Number(stats?.no_shows || 0)}</Text>
        </View>
      </View>

      <View style={styles.actionsSection}>
        <Text style={styles.sectionTitle}>{tr('dash.quickActions')}</Text>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('ScanQR')}
        >
          <View style={[styles.actionIconBox, { backgroundColor: t.colors.brandTint }]}>
            <CheckIcon size={24} color={t.colors.brandText} />
          </View>
          <View style={styles.actionTextContent}>
            <Text style={styles.actionTitle}>{tr('dash.scanQr')}</Text>
            <Text style={styles.actionSubtitle}>{tr('dash.scanQrSub')}</Text>
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
            <Text style={styles.actionTitle}>{tr('dash.feedback')}</Text>
            <Text style={styles.actionSubtitle}>{tr('dash.feedbackSub')}</Text>
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
            <Text style={styles.actionTitle}>{tr('dash.manageSlots')}</Text>
            <Text style={styles.actionSubtitle}>{tr('dash.manageSlotsSub')}</Text>
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
            <Text style={styles.actionTitle}>{tr('dash.editPump')}</Text>
            <Text style={styles.actionSubtitle}>{tr('dash.editPumpSub')}</Text>
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
    flexBasis: 0,
    minWidth: 0,
    justifyContent: 'flex-start',
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
    lineHeight: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  // Reserve two lines so a label that wraps ("Total Bookings" on narrow phones) never pushes the
  // number lower than its neighbour: both numbers always start at the same offset.
  statLabelTwoLine: { minHeight: 40 },
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
