import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme, type Theme } from '../theme';
import { StarsDisplay } from './StarRating';
import { formatRatingSummary, tagLabel } from '../ratings/ratingModel';
import type { PumpReviews, ReviewItem } from '../services/rating.service';

export function RatingSummaryCard({ data }: { data: Pick<PumpReviews, 'average' | 'count' | 'distribution'> }) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const s = formatRatingSummary(data.average, data.count);
  const max = Math.max(1, ...[1, 2, 3, 4, 5].map((n) => data.distribution?.[String(n) as '1'] ?? 0));

  return (
    <View style={styles.card} accessible accessibilityLabel={s.a11y}>
      <View style={styles.left}>
        <Text style={styles.big}>{s.hasRating ? s.average!.toFixed(1) : '--'}</Text>
        <StarsDisplay average={s.hasRating ? s.average! : null} size={16} />
        <Text style={styles.count}>{s.hasRating ? `${data.count} ${data.count === 1 ? 'review' : 'reviews'}` : 'No reviews yet'}</Text>
      </View>
      <View style={styles.bars}>
        {[5, 4, 3, 2, 1].map((n) => {
          const c = data.distribution?.[String(n) as '1'] ?? 0;
          return (
            <View key={n} style={styles.barRow}>
              <Text style={styles.barLabel}>{n}</Text>
              <MaterialCommunityIcons name="star" size={11} color={t.colors.star} />
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${(c / max) * 100}%` }]} />
              </View>
              <Text style={styles.barCount}>{c}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function ReviewRow({ item, footer }: { item: ReviewItem; footer?: React.ReactNode }) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const date = new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <View style={[styles.row, item.status === 'hidden' && { opacity: 0.6 }]} accessible accessibilityLabel={`${item.rating} stars by ${item.reviewer}`}>
      <View style={styles.rowTop}>
        <StarsDisplay average={item.rating} size={14} />
        <Text style={styles.reviewer}>{item.reviewer}</Text>
        <Text style={styles.date}>{date}{item.edited ? ' (edited)' : ''}</Text>
      </View>
      {item.tags?.length ? (
        <View style={styles.tags}>
          {item.tags.map((id) => (
            <View key={id} style={styles.tag}>
              <Text style={styles.tagText}>{tagLabel(id)}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {item.review ? <Text style={styles.body}>{item.review}</Text> : null}
      <View style={styles.meta}>
        <MaterialCommunityIcons name="check-decagram-outline" size={13} color={t.colors.brandText} />
        <Text style={styles.metaText}>Verified visit</Text>
        {item.status === 'hidden' ? <Text style={[styles.metaText, { color: t.colors.warningText }]}>  Hidden after moderation</Text> : null}
        {item.report_status === 'open' ? <Text style={[styles.metaText, { color: t.colors.infoText }]}>  Reported - under review</Text> : null}
      </View>
      {footer}
    </View>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    card: { flexDirection: 'row', gap: 18, backgroundColor: t.colors.surface, borderRadius: 16, borderWidth: 1, borderColor: t.colors.border, padding: 16, alignItems: 'center' },
    left: { alignItems: 'center', gap: 4, minWidth: 92 },
    big: { color: t.colors.text, fontSize: 38, fontWeight: '900' },
    count: { color: t.colors.textSecondary, fontSize: 12 },
    bars: { flex: 1, gap: 5 },
    barRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    barLabel: { color: t.colors.textSecondary, fontSize: 11, width: 10, textAlign: 'right' },
    track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: t.colors.surfaceAlt, overflow: 'hidden' },
    fill: { height: 6, borderRadius: 3, backgroundColor: t.colors.star },
    barCount: { color: t.colors.textMuted, fontSize: 11, width: 24 },
    row: { backgroundColor: t.colors.surface, borderRadius: 14, borderWidth: 1, borderColor: t.colors.border, padding: 14, gap: 8 },
    rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    reviewer: { color: t.colors.text, fontWeight: '700', fontSize: 13 },
    date: { color: t.colors.textMuted, fontSize: 12, marginLeft: 'auto' },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    tag: { borderRadius: 12, borderWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.surfaceAlt, paddingHorizontal: 8, paddingVertical: 3 },
    tagText: { color: t.colors.textSecondary, fontSize: 11, fontWeight: '600' },
    body: { color: t.colors.text, fontSize: 14, lineHeight: 20 },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
    metaText: { color: t.colors.textMuted, fontSize: 11, fontWeight: '600' },
  });
