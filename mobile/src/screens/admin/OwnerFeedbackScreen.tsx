import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme, type Theme } from '../../theme';
import OverflowMenu from '../../components/OverflowMenu';
import { apiErrorMessage } from '../../i18n/errors';
import { pumpService } from '../../services/pump.service';
import { ratingService, type PumpReviews, type ReviewItem } from '../../services/rating.service';
import { RatingSummaryCard, ReviewRow } from '../../components/ReviewParts';
import { useT } from '../../i18n';

// Owner view of feedback for THEIR pump. Owners can report a review (admin decides);
// they cannot edit or delete it. Reviewers are shown by first name only.
export default function OwnerFeedbackScreen({ navigation }: any) {
  const t = useTheme();
  const { tr, fmt } = useT();
  const styles = useMemo(() => createStyles(t), [t]);

  const [pumpId, setPumpId] = useState<string | null>(null);
  const [noPump, setNoPump] = useState(false);
  const [data, setData] = useState<PumpReviews | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [reporting, setReporting] = useState<ReviewItem | null>(null);
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const load = useCallback(async (pull = false) => {
    if (pull) setRefreshing(true);
    else setLoading(true);
    setError(false);
    setErrorMsg(null);
    try {
      let id = pumpId;
      if (!id) {
        const mine = await pumpService.getMyPump();
        if (!mine.pump) {
          setNoPump(true);
          return;
        }
        id = mine.pump.id;
        setPumpId(id);
      }
      setData(await ratingService.ownerFeedback(id, 0));
    } catch (e: any) {
      // A failed request is an error state with the real reason; it is never shown as "no reviews".
      setError(true);
      setErrorMsg(apiErrorMessage(e, tr));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [pumpId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const more = async () => {
    if (!data || !data.has_more || loadingMore || !pumpId) return;
    setLoadingMore(true);
    try {
      const next = await ratingService.ownerFeedback(pumpId, data.reviews.length);
      setData({ ...next, reviews: [...data.reviews, ...next.reviews] });
    } catch {
      // keep current list
    } finally {
      setLoadingMore(false);
    }
  };

  const sendReport = async () => {
    if (!reporting || sending) return;
    setSending(true);
    setReportError(null);
    try {
      await ratingService.report(reporting.id, reason.trim());
      const id = reporting.id;
      setData((d) => (d ? { ...d, reviews: d.reviews.map((r) => (r.id === id ? { ...r, report_status: 'open' } : r)) } : d));
      setReporting(null);
      setReason('');
    } catch (e: any) {
      setReportError(apiErrorMessage(e, tr, 'feedback.reportFailed'));
    } finally {
      setSending(false);
    }
  };

  const trendMax = Math.max(1, ...(data?.trend || []).map((w) => w.count));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} accessibilityLabel={tr('common.back')}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={t.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{tr('feedback.title')}</Text>
        <OverflowMenu style={{ width: 40, height: 40, borderRadius: 20 }} offsetTop={56} />
      </View>

      {loading && !data ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={t.colors.brandText} />
      ) : noPump ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{tr('feedback.registerFirst')}</Text>
        </View>
      ) : error && !data ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="wifi-off" size={28} color={t.colors.textMuted} />
          <Text style={styles.muted}>{tr('feedback.loadFailed')}</Text>
          {errorMsg ? <Text style={styles.hint}>{errorMsg}</Text> : null}
          <TouchableOpacity style={styles.retry} onPress={() => load()} accessibilityRole="button">
            <Text style={styles.retryText}>{tr('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : data ? (
        <FlatList
          data={data.reviews}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          onEndReached={more}
          onEndReachedThreshold={0.4}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={t.colors.brandText} colors={[t.colors.brand]} />}
          ListHeaderComponent={
            <View style={{ gap: 12 }}>
              <RatingSummaryCard data={data} />
              <View style={styles.trendCard}>
                <Text style={styles.sectionTitle}>{tr('feedback.last8')}</Text>
                <View style={styles.trendRow}>
                  {(data.trend || []).map((w) => (
                    <View key={w.week_ending} style={styles.trendCol} accessible accessibilityLabel={w.average ? tr('feedback.weekA11y', { date: w.week_ending, count: w.count, avg: w.average }) : tr('feedback.weekA11yNoAvg', { date: w.week_ending, count: w.count })}>
                      <Text style={styles.trendAvg}>{w.average ? w.average.toFixed(1) : '-'}</Text>
                      <View style={styles.trendTrack}>
                        <View style={[styles.trendFill, { height: `${(w.count / trendMax) * 100}%` }]} />
                      </View>
                      <Text style={styles.trendCount}>{w.count}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.hint}>{tr('feedback.trendHint')}</Text>
              </View>
              <Text style={styles.sectionTitle}>{tr('feedback.all')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <ReviewRow
              item={item}
              footer={
                item.status !== 'hidden' && !item.report_status ? (
                  <TouchableOpacity style={styles.reportBtn} onPress={() => { setReporting(item); setReason(''); setReportError(null); }} accessibilityRole="button" accessibilityLabel={tr('feedback.reportA11y')}>
                    <MaterialCommunityIcons name="flag-outline" size={14} color={t.colors.textSecondary} />
                    <Text style={styles.reportText}>{tr('feedback.report')}</Text>
                  </TouchableOpacity>
                ) : null
              }
            />
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <MaterialCommunityIcons name="star-outline" size={28} color={t.colors.textMuted} />
              <Text style={styles.muted}>{tr('feedback.empty')}</Text>
            </View>
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator color={t.colors.brandText} /> : null}
        />
      ) : null}

      <Modal visible={!!reporting} transparent animationType="fade" onRequestClose={() => setReporting(null)}>
        <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{tr('feedback.reportTitle')}</Text>
            <Text style={styles.hint}>
              {tr('feedback.reportBody')}
            </Text>
            <TextInput
              style={styles.input}
              multiline
              value={reason}
              onChangeText={setReason}
              maxLength={500}
              placeholder={tr('feedback.reasonPlaceholder')}
              placeholderTextColor={t.colors.placeholder}
              accessibilityLabel={tr('feedback.reasonLabel')}
              textAlignVertical="top"
            />
            {reportError ? <Text style={[styles.hint, { color: t.colors.dangerText }]}>{reportError}</Text> : null}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalGhost]} onPress={() => setReporting(null)} disabled={sending}>
                <Text style={styles.modalGhostText}>{tr('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalPrimary, (reason.trim().length < 5 || sending) && { opacity: 0.5 }]}
                onPress={sendReport}
                disabled={reason.trim().length < 5 || sending}
              >
                {sending ? <ActivityIndicator color={t.colors.onBrand} /> : <Text style={styles.modalPrimaryText}>{tr('feedback.sendReport')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.bg },
    header: { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
    back: { width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.surface, alignItems: 'center', justifyContent: 'center' },
    title: { flex: 1, color: t.colors.text, fontSize: 20, fontWeight: '800' },
    center: { alignItems: 'center', gap: 10, paddingVertical: 40, paddingHorizontal: 24 },
    muted: { color: t.colors.textSecondary, textAlign: 'center', fontSize: 14 },
    retry: { backgroundColor: t.colors.brand, borderRadius: 12, paddingHorizontal: 24, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    retryText: { color: t.colors.onBrand, fontWeight: '800' },
    sectionTitle: { color: t.colors.text, fontWeight: '800', fontSize: 15 },
    hint: { color: t.colors.textSecondary, fontSize: 12, lineHeight: 17 },
    trendCard: { backgroundColor: t.colors.surface, borderRadius: 16, borderWidth: 1, borderColor: t.colors.border, padding: 14, gap: 10 },
    trendRow: { flexDirection: 'row', gap: 6, height: 110, alignItems: 'flex-end' },
    trendCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 3 },
    trendAvg: { color: t.colors.textSecondary, fontSize: 10, fontWeight: '700' },
    trendTrack: { width: '70%', flex: 1, backgroundColor: t.colors.surfaceAlt, borderRadius: 4, justifyContent: 'flex-end', overflow: 'hidden' },
    trendFill: { backgroundColor: t.colors.brand, width: '100%', borderRadius: 4 },
    trendCount: { color: t.colors.textMuted, fontSize: 10 },
    reportBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', minHeight: 32 },
    reportText: { color: t.colors.textSecondary, fontSize: 12, fontWeight: '700' },
    modalRoot: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: t.colors.scrim },
    modalCard: { backgroundColor: t.colors.surfaceRaised, borderRadius: 18, padding: 18, gap: 10, borderWidth: 1, borderColor: t.colors.border },
    modalTitle: { color: t.colors.text, fontWeight: '800', fontSize: 18 },
    input: { minHeight: 90, borderRadius: 12, borderWidth: 1, borderColor: t.colors.inputBorder, backgroundColor: t.colors.inputBg, color: t.colors.text, padding: 12, fontSize: 14 },
    modalBtn: { flex: 1, minHeight: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    modalGhost: { borderWidth: 1, borderColor: t.colors.border },
    modalGhostText: { color: t.colors.textSecondary, fontWeight: '700' },
    modalPrimary: { backgroundColor: t.colors.brand },
    modalPrimaryText: { color: t.colors.onBrand, fontWeight: '800' },
  });
