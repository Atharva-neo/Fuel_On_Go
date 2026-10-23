import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme, type Theme } from '../theme';
import RateSheet from './RateSheet';
import { StarsDisplay } from './StarRating';
import { ratingService, type Eligibility } from '../services/rating.service';

// "Rate this pump" entry shown on completed bookings in the history list. Lets customers
// who dismissed the first prompt rate later, and shows/edit-links an existing rating.
export default function BookingRateAction({ bookingId, pumpId, pumpName }: { bookingId: string; pumpId?: string; pumpName: string }) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const [elig, setElig] = useState<Eligibility | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setElig(await ratingService.eligibility(bookingId));
    } catch {
      setElig(null); // no entry point if eligibility cannot be confirmed
    }
  }, [bookingId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!elig?.eligible) return null;

  return (
    <View style={styles.row}>
      {elig.rating ? (
        <View style={styles.rated} accessible accessibilityLabel={`You rated this pump ${elig.rating.rating} out of 5`}>
          <StarsDisplay average={elig.rating.rating} size={14} />
          <Text style={styles.ratedText}>Your rating</Text>
        </View>
      ) : (
        <View style={styles.rated}>
          <MaterialCommunityIcons name="star-outline" size={16} color={t.colors.star} />
          <Text style={styles.ratedText}>Rate this pump</Text>
        </View>
      )}
      {!elig.rating || elig.rating.editable ? (
        <TouchableOpacity
          style={styles.btn}
          // the card around this button is itself pressable; keep this press from also opening the booking
          onPress={(e: any) => {
            e?.stopPropagation?.();
            setOpen(true);
          }} accessibilityRole="button" accessibilityLabel={elig.rating ? 'Edit rating' : 'Rate this pump'}>
          <Text style={styles.btnText}>{elig.rating ? 'Edit' : 'Rate'}</Text>
        </TouchableOpacity>
      ) : null}

      <RateSheet
        visible={open}
        bookingId={bookingId}
        pumpId={pumpId}
        pumpName={pumpName}
        initial={elig.rating ? { rating: elig.rating.rating, review: elig.rating.review || '', tags: elig.rating.tags } : null}
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
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 10,
      marginTop: 10,
      borderTopWidth: 1,
      borderTopColor: t.colors.border,
    },
    rated: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    ratedText: { color: t.colors.textSecondary, fontSize: 13, fontWeight: '600' },
    btn: { minHeight: 36, paddingHorizontal: 16, borderRadius: 18, backgroundColor: t.colors.brand, alignItems: 'center', justifyContent: 'center' },
    btnText: { color: t.colors.onBrand, fontWeight: '800', fontSize: 13 },
  });
