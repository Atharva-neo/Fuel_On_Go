import React, { useMemo, useCallback, useState } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { trustService, TrustSummary } from '../../services/trust.service';
import { useAuthStore } from '../../store/authStore';
import { CheckIcon, ChevronRightIcon, InfoIcon } from '../../components/ui/Icons';
import api from '../../config/api';
import ThemeToggle from '../../components/ThemeToggle';
import LanguageSelector from '../../components/LanguageSelector';
import { useTheme, type Theme } from '../../theme';
import { useT } from '../../i18n';


export default function ProfileScreen({ navigation }: any) {
  const t = useTheme();
  const { tr, fmt } = useT();
  const styles = useMemo(() => createStyles(t), [t]);
  // Band colours come from theme tokens; the label text always names the band too.
  const bandColors: Record<string, { fill: string; text: string; tint: string }> = {
    excellent: { fill: t.colors.brand, text: t.colors.brandText, tint: t.colors.brandTint },
    good: { fill: t.colors.success, text: t.colors.successText, tint: t.colors.successTint },
    fair: { fill: t.colors.info, text: t.colors.infoText, tint: t.colors.infoTint },
    low: { fill: t.colors.warning, text: t.colors.warningText, tint: t.colors.warningTint },
    very_low: { fill: t.colors.danger, text: t.colors.dangerText, tint: t.colors.dangerTint },
  };
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

  const [trust, setTrust] = useState<TrustSummary | null>(null);
  const [trustLoading, setTrustLoading] = useState(true);
  const [trustError, setTrustError] = useState(false);

  const loadTrust = useCallback(async () => {
    setTrustLoading(true);
    setTrustError(false);
    try {
      setTrust(await trustService.getMine(5));
    } catch {
      setTrustError(true);
    } finally {
      setTrustLoading(false);
    }
  }, []);

  // Refetch whenever the screen is focused so a cancellation made elsewhere shows up.
  useFocusEffect(
    useCallback(() => {
      loadTrust();
    }, [loadTrust, token])
  );

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

  const translateEvent = (type: string) => (['cancellation', 'no_show', 'dispute_reversal'].includes(type) ? tr(`trust.event.${type}`) : type);

  const handleLogout = () => {
    Alert.alert(tr('profile.logoutTitle'), tr('profile.logoutConfirm'), [
      { text: tr('common.cancel'), style: 'cancel' },
      { text: tr('profile.logout'), style: 'destructive', onPress: async () => {
          // RootGate watches token — clearing it automatically shows WelcomeScreen
          await logout();
        }
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.themeToggle}>
          <ThemeToggle />
        </View>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarInitial}>{user?.name?.charAt(0)?.toUpperCase() || 'U'}</Text>
        </View>
        <Text style={styles.name}>{user?.name || tr('profile.defaultName')}</Text>
        <Text style={styles.phone}>{user?.phone || '+91 00000 00000'}</Text>

        <View style={styles.trustBadge}>
          <CheckIcon size={14} color={t.colors.brandText} />
          <Text style={styles.trustText}>{tr('profile.verified')}</Text>
        </View>
      </View>

      {statsLoading ? (
        <View style={styles.statsLoader}>
          <ActivityIndicator color={t.colors.brandText} />
        </View>
      ) : (
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.total_bookings}</Text>
            <Text style={styles.statLabel}>{tr('profile.totalBookings')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.no_show_count}</Text>
            <Text style={styles.statLabel}>{tr('profile.noShows')}</Text>
          </View>
        </View>
      )}

      <View style={styles.trustCard}>
        <Text style={styles.sectionTitle}>{tr('trust.title')}</Text>
        {trustLoading && !trust ? (
          <ActivityIndicator color={t.colors.brandText} />
        ) : trustError && !trust ? (
          <View style={styles.trustErrorBox}>
            <Text style={styles.trustErrorText}>{tr('trust.loadFailed')}</Text>
            <TouchableOpacity style={styles.trustRetry} onPress={loadTrust}>
              <Text style={styles.trustRetryText}>{tr('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : trust ? (
          <>
            <View style={styles.trustTop}>
              <Text style={[styles.trustScore, { color: bandColors[trust.band].text }]}>{trust.score}</Text>
              <View style={[styles.trustChip, { backgroundColor: bandColors[trust.band].tint }]}>
                <Text style={[styles.trustChipText, { color: bandColors[trust.band].text }]}>{tr(`trust.band.${trust.band}`)}</Text>
              </View>
            </View>
            <View style={styles.trustTrack}>
              <View style={[styles.trustFill, { width: `${trust.score}%`, backgroundColor: bandColors[trust.band].fill }]} />
            </View>
            {trustError ? <Text style={styles.trustStale}>{tr('trust.stale')}</Text> : null}
            {trust.recent_events.length === 0 ? (
              <Text style={styles.trustEmpty}>
                {trust.history_available ? tr('trust.empty') : tr('trust.historyUnavailable')}
              </Text>
            ) : (
              trust.recent_events.map((e) => (
                <View key={e.id} style={styles.trustEvent}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.trustEventTitle}>{translateEvent(e.event_type)}{e.reversed ? ` ${tr('trust.reversed')}` : ''}</Text>
                    <Text style={styles.trustEventDate}>{fmt.date(String(e.created_at).slice(0, 10))}</Text>
                  </View>
                  <Text style={[styles.trustDelta, e.delta < 0 ? { color: t.colors.dangerText } : e.delta > 0 ? { color: t.colors.brandText } : null]}>
                    {e.delta > 0 ? `+${e.delta}` : e.delta}
                  </Text>
                </View>
              ))
            )}
          </>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{tr('profile.language')}</Text>
        <LanguageSelector />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{tr('profile.accountSettings')}</Text>

        <TouchableOpacity style={styles.menuItem} onPress={() => setPrefOpen(true)}>
          <View style={styles.menuItemLeft}>
            <View style={[styles.menuIconBox, { backgroundColor: t.colors.brandTint }]}>
              <InfoIcon size={18} color={t.colors.brandText} />
            </View>
            <Text style={styles.menuItemText}>{tr('profile.preferences')}</Text>
          </View>
          <ChevronRightIcon size={16} color={t.colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => setHelpOpen(true)}>
          <View style={styles.menuItemLeft}>
            <View style={[styles.menuIconBox, { backgroundColor: t.colors.infoTint }]}>
              <InfoIcon size={18} color={t.colors.infoText} />
            </View>
            <Text style={styles.menuItemText}>{tr('profile.helpSupport')}</Text>
          </View>
          <ChevronRightIcon size={16} color={t.colors.textMuted} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>{tr('profile.logout')}</Text>
      </TouchableOpacity>

      {/* Preferences Modal */}
      <Modal visible={prefOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{tr('profile.preferences')}</Text>

            <View style={styles.prefRow}>
              <Text style={styles.prefLabel}>{tr('profile.pushNotifications')}</Text>
              <Switch value={true} trackColor={{ true: t.colors.brandText, false: t.colors.textMuted }} />
            </View>
            <View style={styles.prefRow}>
              <Text style={styles.prefLabel}>{tr('profile.smsAlerts')}</Text>
              <Switch value={false} trackColor={{ true: t.colors.brandText, false: t.colors.textMuted }} />
            </View>

            <TouchableOpacity style={styles.modalBtn} onPress={() => setPrefOpen(false)}>
              <Text style={styles.modalBtnText}>{tr('common.done')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Help Modal */}
      <Modal visible={helpOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{tr('profile.helpSupport')}</Text>
            <Text style={styles.helpText}>{tr('profile.callUs')}</Text>
            <Text style={styles.helpSub}>{tr('profile.hours')}</Text>

            <TouchableOpacity style={styles.modalBtn} onPress={() => setHelpOpen(false)}>
              <Text style={styles.modalBtnText}>{tr('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const createStyles = (t: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.colors.bg,
  },
  content: {
    paddingBottom: 40,
  },
  header: {
    backgroundColor: t.colors.surface,
    alignItems: 'center',
    paddingTop: 80,
    paddingBottom: 40,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  themeToggle: {
    position: 'absolute',
    top: 48,
    right: 20,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: t.colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: t.colors.brand,
  },
  avatarInitial: {
    color: t.colors.brandText,
    fontSize: 32,
    fontWeight: '900',
  },
  name: {
    color: t.colors.text,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  phone: {
    color: t.colors.textMuted,
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 16,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.colors.brandTint,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: t.colors.brand,
  },
  trustText: {
    color: t.colors.brandText,
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
    backgroundColor: t.colors.surface,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: t.colors.border,
    shadowColor: t.colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
    color: t.colors.text,
    marginBottom: 4,
  },
  statValueHighlight: {
    fontSize: 24,
    fontWeight: '900',
    color: t.colors.brandText,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: t.colors.textSecondary,
    fontWeight: '600',
  },
  trustCard: {
    marginHorizontal: 24,
    marginBottom: 24,
    padding: 20,
    backgroundColor: t.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  trustTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  trustScore: { fontSize: 40, fontWeight: '900' },
  trustChip: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  trustChipText: { fontWeight: '800', fontSize: 13 },
  trustTrack: { height: 8, borderRadius: 4, backgroundColor: t.colors.surfaceAlt, overflow: 'hidden', marginBottom: 14 },
  trustFill: { height: 8, borderRadius: 4 },
  trustStale: { color: t.colors.warningText, fontSize: 12, marginBottom: 8 },
  trustEmpty: { color: t.colors.textSecondary, fontSize: 13 },
  trustEvent: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: t.colors.border },
  trustEventTitle: { color: t.colors.text, fontWeight: '600', fontSize: 13 },
  trustEventDate: { color: t.colors.textMuted, fontSize: 11, marginTop: 2 },
  trustDelta: { color: t.colors.textSecondary, fontWeight: '800', fontSize: 15 },
  trustErrorBox: { alignItems: 'center', paddingVertical: 8 },
  trustErrorText: { color: t.colors.textSecondary, marginBottom: 10 },
  trustRetry: { backgroundColor: t.colors.brand, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 10 },
  trustRetryText: { color: t.colors.text, fontWeight: '800' },
  section: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: t.colors.text,
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: t.colors.surface,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: t.colors.border,
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
    color: t.colors.text,
  },
  logoutBtn: {
    marginHorizontal: 24,
    backgroundColor: t.colors.dangerTint,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: t.colors.danger,
  },
  logoutText: {
    color: t.colors.dangerText,
    fontSize: 16,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: t.colors.scrim,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: t.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: t.colors.text,
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
    color: t.colors.text,
  },
  modalBtn: {
    backgroundColor: t.colors.inverse,
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 12,
  },
  modalBtnText: {
    color: t.colors.onInverse,
    fontSize: 16,
    fontWeight: '800',
  },
  helpText: {
    fontSize: 16,
    fontWeight: '700',
    color: t.colors.text,
    marginBottom: 4,
  },
  helpSub: {
    fontSize: 14,
    color: t.colors.textSecondary,
    marginBottom: 24,
  },
});
