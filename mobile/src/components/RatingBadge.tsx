import React from 'react';
import { Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useT } from '../i18n';

// Compact "4.3 (12)" next to a pump. No reviews => "New", never a number.
export default function RatingBadge({ average, count, size = 12 }: { average?: number | null; count?: number | null; size?: number }) {
  const t = useTheme();
  const { fmt } = useT();
  const s = fmt.rating(average, count);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }} accessible accessibilityLabel={s.a11y}>
      {s.hasRating ? <MaterialCommunityIcons name="star" size={size + 1} color={t.colors.star} /> : null}
      <Text style={{ color: s.hasRating ? t.colors.textSecondary : t.colors.textMuted, fontSize: size, fontWeight: '700' }}>{s.short}</Text>
    </View>
  );
}
