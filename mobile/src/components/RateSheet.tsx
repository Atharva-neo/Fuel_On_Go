import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme, type Theme } from '../theme';
import { StarInput } from './StarRating';
import { ratingService, type SubmitResult } from '../services/rating.service';
import { createRatingSubmitter, type RatingDraft, type SubmitState } from '../ratings/submitFlow';
import { MAX_REVIEW_CHARS, RATING_TAGS, canSubmitRating, toggleTag } from '../ratings/ratingModel';
import { useRatingEvents } from '../ratings/ratingEvents';
import { useT } from '../i18n';

interface Props {
  visible: boolean;
  bookingId: string;
  pumpId?: string;
  pumpName: string;
  /** Existing rating when the customer edits it. */
  initial?: Partial<RatingDraft> | null;
  onClose: () => void;
  onSubmitted?: (result: SubmitResult) => void;
}

// Bottom-sheet rating dialog. The pump is identified by the booking on the server;
// this component only sends the booking id.
export default function RateSheet({ visible, bookingId, pumpId, pumpName, initial, onClose, onSubmitted }: Props) {
  const t = useTheme();
  const { tr, fmt } = useT();
  const styles = useMemo(() => createStyles(t), [t]);
  const insets = useSafeAreaInsets();
  const bump = useRatingEvents((s) => s.bump);

  const [state, setState] = useState<SubmitState | null>(null);
  const submitter = useRef<ReturnType<typeof createRatingSubmitter> | null>(null);

  // A fresh draft each time the sheet opens for a booking.
  useEffect(() => {
    if (!visible) return;
    submitter.current = createRatingSubmitter({
      initial: { rating: 0, review: '', tags: [], ...(initial || {}) },
      submit: async (d) => {
        const res = await ratingService.submit({ bookingId, rating: d.rating, review: d.review, tags: d.tags });
        bump(res.pump?.id ?? pumpId ?? null);
        onSubmitted?.(res);
        return res;
      },
      onChange: setState,
    });
    setState(submitter.current.getState());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, bookingId]);

  if (!state || !submitter.current) {
    return <Modal visible={visible} transparent onRequestClose={onClose} />;
  }
  const s = submitter.current;
  const { draft } = state;
  const busy = state.status === 'submitting';
  const done = state.status === 'success';
  const summary = done ? fmt.rating((state.result as SubmitResult).summary.average, (state.result as SubmitResult).summary.count) : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => !busy && onClose()} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={() => !busy && onClose()} accessibilityLabel={tr('rating.closeSheet')} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.handle} />

          {done ? (
            <View style={styles.doneBox} accessibilityLiveRegion="polite">
              <MaterialCommunityIcons name="check-circle" size={44} color={t.colors.brandText} />
              <Text style={styles.title}>{tr('rating.thanks')}</Text>
              {summary?.hasRating ? (
                <Text style={styles.sub}>{tr('rating.nowRated', { pump: pumpName, summary: summary.long })}</Text>
              ) : null}
              <TouchableOpacity style={[styles.primary, { alignSelf: 'stretch' }]} onPress={onClose} accessibilityRole="button">
                <Text style={styles.primaryText}>{tr('common.done')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.title} accessibilityRole="header">
                {tr('rating.ratePump', { pump: pumpName })}
              </Text>
              <Text style={styles.sub}>{tr('rating.howWasVisit')}</Text>

              <View style={styles.starWrap}>
                <StarInput value={draft.rating} onChange={(rating) => s.setDraft({ rating })} disabled={busy} />
                <Text style={styles.ratingLabel} accessibilityLiveRegion="polite">
                  {draft.rating ? tr('rating.starsOfFive', { n: draft.rating, label: tr(`rating.label.${draft.rating}`) }) : tr('rating.tapStar')}
                </Text>
              </View>

              <Text style={styles.sectionLabel}>{tr('rating.whatStoodOut')}</Text>
              <View style={styles.tags}>
                {RATING_TAGS.map((tag) => {
                  const on = draft.tags.includes(tag.id);
                  return (
                    <TouchableOpacity
                      key={tag.id}
                      disabled={busy}
                      onPress={() => s.setDraft({ tags: toggleTag(draft.tags, tag.id) })}
                      style={[styles.tag, on && styles.tagOn]}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on, disabled: busy }}
                      accessibilityLabel={tr(`rating.tag.${tag.id}`)}
                    >
                      {on ? <MaterialCommunityIcons name="check" size={14} color={t.colors.brandText} /> : null}
                      <Text style={[styles.tagText, on && styles.tagTextOn]}>{tr(`rating.tag.${tag.id}`)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.sectionLabel}>{tr('rating.writeReview')}</Text>
              <TextInput
                style={styles.input}
                multiline
                editable={!busy}
                maxLength={MAX_REVIEW_CHARS}
                value={draft.review}
                onChangeText={(review) => s.setDraft({ review })}
                placeholder={tr('rating.reviewPlaceholder')}
                placeholderTextColor={t.colors.placeholder}
                accessibilityLabel={tr('rating.writtenReview')}
                textAlignVertical="top"
              />
              <Text style={styles.counter}>
                {draft.review.length}/{MAX_REVIEW_CHARS}
              </Text>

              {state.status === 'error' && state.error ? (
                <View style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="assertive">
                  <MaterialCommunityIcons name="alert-circle-outline" size={18} color={t.colors.dangerText} />
                  <Text style={styles.errorText}>{state.errorKey ? tr(state.errorKey) : state.error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.primary, (!canSubmitRating(draft) || busy) && styles.primaryDisabled]}
                disabled={!canSubmitRating(draft) || busy}
                onPress={() => s.send()}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSubmitRating(draft) || busy, busy }}
              >
                {busy ? (
                  <ActivityIndicator color={t.colors.onBrand} />
                ) : (
                  <Text style={styles.primaryText}>{state.status === 'error' ? tr('common.tryAgain') : initial ? tr('rating.update') : tr('rating.submit')}</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondary} disabled={busy} onPress={onClose} accessibilityRole="button">
                <Text style={styles.secondaryText}>{tr('rating.notNow')}</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFill as object, backgroundColor: t.colors.scrim },
    sheet: {
      backgroundColor: t.colors.surfaceRaised,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 10,
      maxHeight: '90%',
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: t.colors.border, marginBottom: 14 },
    title: { color: t.colors.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },
    sub: { color: t.colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 4 },
    starWrap: { marginTop: 18, marginBottom: 6, alignItems: 'center', gap: 6 },
    ratingLabel: { color: t.colors.text, fontWeight: '700', fontSize: 15, minHeight: 20 },
    sectionLabel: { color: t.colors.textSecondary, fontWeight: '700', fontSize: 13, marginTop: 18, marginBottom: 8 },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    tag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: 36,
      paddingHorizontal: 12,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surfaceAlt,
    },
    tagOn: { borderColor: t.colors.brand, backgroundColor: t.colors.brandTint },
    tagText: { color: t.colors.textSecondary, fontSize: 13, fontWeight: '600' },
    tagTextOn: { color: t.colors.brandText },
    input: {
      minHeight: 96,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.colors.inputBorder,
      backgroundColor: t.colors.inputBg,
      color: t.colors.text,
      padding: 12,
      fontSize: 14,
    },
    counter: { color: t.colors.textMuted, fontSize: 11, textAlign: 'right', marginTop: 4 },
    error: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'flex-start',
      marginTop: 10,
      padding: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: t.colors.danger,
      backgroundColor: t.colors.dangerTint,
    },
    errorText: { flex: 1, color: t.colors.text, fontSize: 13, lineHeight: 18 },
    primary: { backgroundColor: t.colors.brand, borderRadius: 14, minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
    primaryDisabled: { backgroundColor: t.colors.brandDisabled },
    primaryText: { color: t.colors.onBrand, fontWeight: '800', fontSize: 16 },
    secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
    secondaryText: { color: t.colors.textSecondary, fontWeight: '700', fontSize: 14 },
    doneBox: { alignItems: 'center', gap: 8, paddingVertical: 12 },
  });
