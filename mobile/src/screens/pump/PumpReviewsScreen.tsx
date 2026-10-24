import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { apiErrorMessage } from '../../i18n/errors';
import { useTheme, type Theme } from '../../theme';
import { ratingService, type PumpReviews } from '../../services/rating.service';
import { RatingSummaryCard, ReviewRow } from '../../components/ReviewParts';
import { useRatingEvents } from '../../ratings/ratingEvents';
import { useT } from '../../i18n';

// Customer-facing reviews of one pump: summary, distribution, verified reviews.
export default function PumpReviewsScreen({ route, navigation }: any) {
  const t = useTheme();
  const { tr } = useT();
  const styles = useMemo(() => createStyles(t), [t]);
  const pumpId: string = route.params?.pumpId;
  const pumpName: string = route.params?.pumpName || tr('pump.reviewsTitle');
  const version = useRatingEvents((s) => s.version);

  const [data, setData] = useState<PumpReviews | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (pull = false) => {
    if (pull) setRefreshing(true);
    else setLoading(true);
    setError(false);
    setErrorMsg(null);
    try {
      setData(await ratingService.pumpReviews(pumpId, 0));
    } catch (e: any) {
      setError(true);
      setErrorMsg(apiErrorMessage(e, tr));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [pumpId]);

  // Reload on open and whenever a rating was just saved.
  useEffect(() => {
    load();
  }, [load, version]);

  const more = async () => {
    if (!data || !data.has_more || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await ratingService.pumpReviews(pumpId, data.reviews.length);
      setData({ ...next, reviews: [...data.reviews, ...next.reviews] });
    } catch {
      // keep what we have; the user can scroll again to retry
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} accessibilityLabel={tr('common.back')}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={t.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {pumpName}
        </Text>
      </View>

      {loading && !data ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={t.colors.brandText} />
      ) : error && !data ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="wifi-off" size={28} color={t.colors.textMuted} />
          <Text style={styles.muted}>{tr('pump.reviewsLoadFailed')}</Text>
          {errorMsg ? <Text style={styles.muted}>{errorMsg}</Text> : null}
          <TouchableOpacity style={styles.retry} onPress={() => load()} accessibilityRole="button">
            <Text style={styles.retryText}>{tr('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : data ? (
        <FlatList
          data={data.reviews}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          ListHeaderComponent={<RatingSummaryCard data={data} />}
          renderItem={({ item }) => <ReviewRow item={item} />}
          onEndReached={more}
          onEndReachedThreshold={0.4}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={t.colors.brandText} colors={[t.colors.brand]} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <MaterialCommunityIcons name="star-outline" size={28} color={t.colors.textMuted} />
              <Text style={styles.muted}>{tr('pump.reviewsEmpty')}</Text>
            </View>
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator color={t.colors.brandText} /> : null}
        />
      ) : null}
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
  });
