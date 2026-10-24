import React, { useCallback, useMemo, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { adminService } from '../../services/admin.service';
import { useTheme, type Theme } from '../../theme';
import { useFocusEffect } from '@react-navigation/native';
import { istDate } from '../../utils/schedule';
import DropdownSelect from '../../components/DropdownSelect';
import { apiErrorMessage } from '../../i18n/errors';
import { approvalExpired } from '../../utils/approvalExpiry';
import { STATUS_GROUPS, historyParams, mergePage, shiftDay, type RangeMode, type StatusGroup } from '../../utils/historyFilter';
import { useT } from '../../i18n';


const STATUS_IDS = ['pending', 'confirmed', 'arrived', 'no_show', 'cancelled', 'rejected'];

export default function AdminBookingsScreen({ navigation }: any) {
  const t = useTheme();
  const { tr, fmt } = useT();
  const styles = useMemo(() => createStyles(t), [t]);
  const PAGE = 25;
  // Default: the COMPLETE history, newest visit first. (It used to open on a single day.)
  const [mode, setMode] = useState<RangeMode>('all');
  const [date, setDate] = useState(istDate(0));
  const [group, setGroup] = useState<StatusGroup>('all');
  const [bookings, setBookings] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [actingOn, setActingOn] = useState<string | null>(null);

  // The very same params feed the list and the CSV export.
  const params = useMemo(() => historyParams(mode, date, group), [mode, date, group]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await adminService.getBookingHistory({ ...params, limit: PAGE, offset: 0 });
      setBookings(page.items);
      setTotal(page.total);
      setHasMore(page.has_more);
    } catch (e: any) {
      // A failed request is an error with a retry, never "no bookings".
      setError(apiErrorMessage(e, tr));
    } finally {
      setLoading(false);
    }
  }, [params]);

  const loadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await adminService.getBookingHistory({ ...params, limit: PAGE, offset: bookings.length });
      setBookings((cur) => mergePage(cur, page.items));
      setTotal(page.total);
      setHasMore(page.has_more);
    } catch {
      // keep what is shown; the button stays so the owner can retry
    } finally {
      setLoadingMore(false);
    }
  };

  // Reload when the filter changes AND whenever the screen regains focus (e.g. back from a
  // booking detail where the status changed), so rows are never stale.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const isToday = date === istDate(0);

  // Clock tick so a pending request flips to Expired while the screen stays open.
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);
  const pendingCount = bookings.filter((b) => b.status === 'pending').length;
  const today = istDate(0);
  const rangeLabel =
    mode === 'all'
      ? tr('history.rangeAll')
      : mode === 'week'
      ? tr('history.rangeWeek')
      : date === today
      ? tr('history.today', { date: fmt.date(date) })
      : date === shiftDay(today, -1)
      ? tr('history.yesterday', { date: fmt.date(date) })
      : date === shiftDay(today, 1)
      ? tr('history.tomorrow', { date: fmt.date(date) })
      : fmt.date(date);

  const handleApprove = async (bookingId: string) => {
    setActingOn(bookingId);
    try {
      await adminService.approveBooking(bookingId);
      load();
    } catch (err: any) {
      Alert.alert(
        err?.response?.data?.code === 'BOOKING_EXPIRED' ? tr('owner.requestExpired') : tr('common.error'),
        apiErrorMessage(err, tr, 'owner.approveFailed')
      );
      load(); // the server is the authority: show the booking as it now stands
    } finally {
      setActingOn(null);
    }
  };

  const handleReject = (bookingId: string) => {
    Alert.alert(tr('owner.rejectTitle'), tr('owner.rejectBody'), [
      { text: tr('common.cancel'), style: 'cancel' },
      {
        text: tr('owner.reject'),
        style: 'destructive',
        onPress: async () => {
          setActingOn(bookingId);
          try {
            await adminService.rejectBooking(bookingId);
            load();
          } catch (err: any) {
            Alert.alert(tr('common.error'), apiErrorMessage(err, tr, 'owner.rejectFailed'));
          } finally {
            setActingOn(null);
          }
        },
      },
    ]);
  };

  // Mirrors the server rule (slot start + 15 min grace); the server is the authority.
  const canMarkNoShow = (b: any) => {
    if (b.status !== 'confirmed' || !b.slot_date || !b.slot_start) return false;
    const hms = String(b.slot_start).length <= 5 ? `${b.slot_start}:00` : String(b.slot_start).slice(0, 8);
    const start = new Date(`${String(b.slot_date).slice(0, 10)}T${hms}+05:30`).getTime();
    return Number.isFinite(start) && Date.now() >= start + 15 * 60000;
  };

  const handleNoShow = (bookingId: string) => {
    Alert.alert(
      tr('owner.noShowTitle'),
      tr('owner.noShowBody'),
      [
        { text: tr('common.cancel'), style: 'cancel' },
        {
          text: tr('owner.noShowConfirm'),
          style: 'destructive',
          onPress: async () => {
            setActingOn(bookingId);
            try {
              await adminService.markNoShow(bookingId);
              load();
            } catch (err: any) {
              Alert.alert(tr('common.error'), apiErrorMessage(err, tr, 'owner.noShowFailed'));
            } finally {
              setActingOn(null);
            }
          },
        },
      ]
    );
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const csv = await adminService.exportBookingsCsv(params); // same filter as the list
      const file = new File(Paths.cache, `fuel-on-go-bookings-${Date.now()}.csv`);
      file.create();
      file.write(csv);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'text/csv',
          dialogTitle: tr('history.exportTitle'),
        });
      } else {
        Alert.alert(tr('history.savedTitle'), tr('history.savedBody', { uri: file.uri }));
      }
    } catch (err: any) {
      Alert.alert(tr('history.exportFailed'), apiErrorMessage(err, tr, 'history.exportFailedBody'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.titleWithBadge}>
            <Text style={styles.title}>{tr('history.title')}</Text>
            {pendingCount > 0 ? (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>{tr('history.pendingBadge', { count: pendingCount })}</Text>
              </View>
            ) : null}
          </View>
          <TouchableOpacity
            style={styles.exportBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={tr('history.export')}
            onPress={handleExport}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator size="small" color={t.colors.brandText} />
            ) : (
              <MaterialCommunityIcons name="download-outline" size={20} color={t.colors.brandText} />
            )}
          </TouchableOpacity>
        </View>
        <View style={styles.chipRow}>
          <DropdownSelect
            display={rangeLabel}
            accessibilityLabel={tr('history.rangeLabel')}
            title={tr('history.rangeLabel')}
            value={mode}
            onChange={(m: RangeMode) => {
              setMode(m);
              if (m === 'day') setDate(istDate(0));
            }}
            options={[
              { value: 'all', label: tr('history.rangeAll') },
              { value: 'week', label: tr('history.rangeWeek') },
              { value: 'day', label: tr('history.rangeDay') },
            ]}
          />
        </View>

        {mode === 'day' ? (
          <View style={styles.dateRow}>
            <TouchableOpacity style={styles.dateBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} onPress={() => setDate(shiftDay(date, -1))}>
              <Text style={styles.dateAction}>{tr('history.prevDay')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setDate(istDate(0))} disabled={isToday}>
              <Text style={[styles.date, isToday && styles.dateToday]}>{fmt.date(date)}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dateBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} onPress={() => setDate(shiftDay(date, 1))}>
              <Text style={styles.dateAction}>{tr('history.nextDay')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {STATUS_GROUPS.map((g) => (
            <TouchableOpacity
              key={g.key}
              style={[styles.chip, group === g.key && styles.chipActive]}
              onPress={() => setGroup(g.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: group === g.key }}
            >
              <Text style={[styles.chipText, group === g.key && styles.chipTextActive]}>{tr(`history.status.${g.key}`)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.summary}>
          {loading ? `${rangeLabel} - ...` : tr('history.summary', { range: rangeLabel, count: total })}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={t.colors.brandText} style={{ marginTop: 24 }} />
      ) : error ? (
        <View style={{ alignItems: 'center', padding: 24, gap: 10 }}>
          <Text style={styles.empty}>{tr('history.loadFailed')}</Text>
          <Text style={styles.meta}>{error}</Text>
          <TouchableOpacity style={styles.chip} onPress={load} accessibilityRole="button">
            <Text style={styles.chipTextActive}>{tr('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 24 }}>
          {bookings.map((booking) => {
            const isPending = booking.status === 'pending';
            const expired = isPending && approvalExpired(booking, nowMs);
            const isNegative = booking.status === 'cancelled' || booking.status === 'rejected';
            return (
              <TouchableOpacity
                key={booking.id}
                style={[styles.card, isPending && styles.cardPending]}
                onPress={() => navigation.navigate('AdminBookingDetail', { bookingId: booking.id, booking })}
                activeOpacity={0.8}
              >
                <Text style={styles.customer}>{booking.user?.name || booking.user_name || tr('ownerDetail.customerFallback')}</Text>
                <Text style={styles.meta}>{booking.user?.vehicle_number || booking.vehicle_number || '-'}</Text>
                <Text style={styles.meta}>
                  {mode === 'day' ? '' : `${fmt.date(String(booking.slot_date))}  `}
                  {fmt.clock(String(booking.slot_start))} - {fmt.clock(String(booking.slot_end))}
                </Text>
                <View style={[styles.badge, isNegative && styles.badgeNegative, isPending && styles.badgePending]}>
                  <Text style={[styles.badgeText, isNegative && styles.badgeTextNegative, isPending && styles.badgeTextPending]}>
                    {STATUS_IDS.includes(booking.status) ? tr(`status.${booking.status}`) : booking.status}
                  </Text>
                </View>

                {isPending ? (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.rejectBtn}
                      disabled={actingOn === booking.id}
                      onPress={() => handleReject(booking.id)}
                    >
                      <Text style={styles.rejectBtnText}>{tr('owner.reject')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.approveBtn, expired && styles.approveBtnDisabled]}
                      disabled={actingOn === booking.id || expired}
                      accessibilityState={{ disabled: expired }}
                      onPress={() => handleApprove(booking.id)}
                    >
                      {actingOn === booking.id ? (
                        <ActivityIndicator size="small" color={t.colors.onBrand} />
                      ) : (
                        <Text style={[styles.approveBtnText, expired && styles.approveBtnTextDisabled]}>{expired ? tr('owner.expired') : tr('owner.approve')}</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : null}
                {isPending && expired ? (
                  <Text style={styles.expiredNote}>{tr('owner.expiredNote')}</Text>
                ) : null}

                {canMarkNoShow(booking) ? (
                  <TouchableOpacity
                    style={styles.noShowBtn}
                    disabled={actingOn === booking.id}
                    onPress={() => handleNoShow(booking.id)}
                  >
                    {actingOn === booking.id ? (
                      <ActivityIndicator size="small" color={t.colors.dangerText} />
                    ) : (
                      <Text style={styles.rejectBtnText}>{tr('owner.markNoShow')}</Text>
                    )}
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            );
          })}
          {bookings.length === 0 ? <Text style={styles.empty}>{tr('history.noMatch')}</Text> : null}
          {hasMore ? (
            <TouchableOpacity style={[styles.chip, { alignSelf: 'center', marginTop: 8 }]} onPress={loadMore} disabled={loadingMore} accessibilityRole="button">
              {loadingMore ? <ActivityIndicator size="small" color={t.colors.brandText} /> : <Text style={styles.chipTextActive}>{tr('history.loadMore', { count: total - bookings.length })}</Text>}
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const createStyles = (t: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.colors.bg,
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: t.colors.bg,
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
    color: t.colors.text,
    fontWeight: '700',
    fontSize: 24,
  },
  pendingBadge: {
    backgroundColor: t.colors.warningTint,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pendingBadgeText: {
    color: t.colors.warningText,
    fontWeight: '700',
    fontSize: 12,
  },
  exportBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: t.colors.brandTint,
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
    color: t.colors.brandText,
    fontWeight: '700',
    fontSize: 13,
  },
  date: {
    color: t.colors.textMuted,
    fontWeight: '700',
    fontSize: 13,
  },
  dateToday: {
    color: t.colors.text,
  },
  card: {
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  cardPending: {
    borderColor: t.colors.warning,
  },
  customer: {
    color: t.colors.text,
    fontWeight: '800',
    fontSize: 15,
  },
  meta: {
    color: t.colors.textMuted,
    marginTop: 4,
    fontSize: 13,
  },
  badge: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: t.colors.brandTint,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgePending: {
    backgroundColor: t.colors.warningTint,
  },
  badgeNegative: {
    backgroundColor: t.colors.dangerTint,
  },
  badgeText: {
    color: t.colors.brandText,
    fontWeight: '700',
    textTransform: 'capitalize',
    fontSize: 12,
  },
  badgeTextPending: {
    color: t.colors.warningText,
  },
  badgeTextNegative: {
    color: t.colors.dangerText,
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
    backgroundColor: t.colors.dangerTint,
    borderWidth: 1,
    borderColor: t.colors.danger,
  },
  rejectBtnText: {
    color: t.colors.dangerText,
    fontWeight: '700',
    fontSize: 13,
  },
  noShowBtn: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: t.colors.dangerTint,
    borderWidth: 1,
    borderColor: t.colors.danger,
  },
  approveBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: t.colors.brand,
  },
  approveBtnDisabled: { backgroundColor: t.colors.surfaceAlt, borderWidth: 1, borderColor: t.colors.border },
  approveBtnTextDisabled: { color: t.colors.textMuted },
  expiredNote: { color: t.colors.textSecondary, fontSize: 12, marginTop: 8, lineHeight: 17 },
  approveBtnText: {
    color: t.colors.onBrand,
    fontWeight: '700',
    fontSize: 13,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, alignItems: 'center' },
  chip: {
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: t.colors.brandTint, borderColor: t.colors.brand },
  chipText: { color: t.colors.textSecondary, fontWeight: '700', fontSize: 13 },
  chipTextActive: { color: t.colors.brandText, fontWeight: '800', fontSize: 13 },
  summary: { color: t.colors.textSecondary, fontSize: 12, fontWeight: '600', marginTop: 10 },
  empty: {
    textAlign: 'center',
    color: t.colors.textSecondary,
    marginTop: 18,
  },
});
