import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme, type Theme } from '../theme';
import RateSheet from './RateSheet';
import { StarsDisplay } from './StarRating';
import { ratingService, type Eligibility } from '../services/rating.service';
import { rateActionState } from '../ratings/ratingModel';

// "Rate this pump" entry shown on completed bookings in the history list. Lets customers
// who dismissed the first prompt rate later, and shows/edit-links an existing rating.
export default function BookingRateAction({ bookingId, pumpId, pumpName }: { bookingId: string; pumpId?: string; pumpName: string }) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const [elig, setElig] = useState<Eligibility | null>(null);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      setFailed(false);
      setElig(await ratingService.eligibility(bookingId));
    } catch {
      // Never hide the option on a completed visit: keep the button; the server re-checks on submit.
      setElig(null);
      setFailed(true);
    }
  }, [bookingId]);

  useEffect(() => {
    load();
  }, [load]);

  const action = rateActionState(elig, failed);
  if (action === 'hidden') return null;
  const rating = elig?.rating ?? null;

  return (
    <View style={styles.row}>
      {rating ? (
        <View style={styles.rated} accessible accessibilityLabel={`You rated this pump ${rating.rating} out of 5`}>
          <StarsDisplay average={rating.rating} size={14} />
          <Text style={styles.ratedText} numberOfLines={1}>Your rating</Text>
        </View>
      ) : (
        <View style={styles.rated}>
          <View style={styles.iconBox}>
            <MaterialCommunityIcons name="star-outline" size={20} color={t.colors.star} />
          </View>
          <Text style={styles.ratedText} numberOfLines={1}>Rate this pump</Text>
        </View>
      )}
      {action === 'rate' || action === 'edit' ? (
        <TouchableOpacity
          style={styles.btn}
          // the card around this button is itself pressable; keep this press from also opening the booking
          onPress={(e: any) => {
            e?.stopPropagation?.();
            setOpen(true);
          }} accessibilityRole="button" accessibilityLabel={rating ? 'Edit rating' : 'Rate this pump'}>
          <Text style={styles.btnText}>{rating ? 'Edit' : 'Rate'}</Text>
        </TouchableOpacity>
      ) : null}

      <RateSheet
        visible={open}
        bookingId={bookingId}
        pumpId={pumpId}
        pumpName={pumpName}
        initial={rating ? { rating: rating.rating, review: rating.review || '', tags: rating.tags } : null}
        onClose={() => {
          setOpen(false);
          load();
        }}
      />
    </View>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    // One row: [icon + label (shrinks, never overflows)] [button]. On very narrow cards the button
    // drops under the label instead of overlapping it (flexWrap), so no per-screen margins are needed.
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      columnGap: 12,
      rowGap: 8,
      paddingVertical: 12,
      marginTop: 10,
      borderTopWidth: 1,
      borderTopColor: t.colors.border,
    },
    rated: { flex: 1, minWidth: 140, flexDirection: 'row', alignItems: 'center', gap: 8 },
    iconBox: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
    ratedText: { flexShrink: 1, color: t.colors.textSecondary, fontSize: 14, fontWeight: '600', lineHeight: 20 },
    btn: {
      minHeight: 40,
      minWidth: 72,
      paddingHorizontal: 18,
      borderRadius: 20,
      backgroundColor: t.colors.brand,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 'auto',
    },
    btnText: { color: t.colors.onBrand, fontWeight: '800', fontSize: 14 },
  });
