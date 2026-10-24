import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import {  starFills, stepRating } from '../ratings/ratingModel';
import { useT } from '../i18n';

// Read-only stars for averages (supports half stars).
export function StarsDisplay({ average, size = 16 }: { average: number | null; size?: number }) {
  const t = useTheme();
  const { tr } = useT();
  const fills = starFills(average);
  return (
    <View style={{ flexDirection: 'row', gap: 2 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {fills.map((f, i) => (
        <MaterialCommunityIcons
          key={i}
          name={f === 'full' ? 'star' : f === 'half' ? 'star-half-full' : 'star-outline'}
          size={size}
          color={f === 'empty' ? t.colors.starEmpty : t.colors.star}
        />
      ))}
    </View>
  );
}

interface InputProps {
  value: number;
  onChange: (next: number) => void;
  size?: number;
  disabled?: boolean;
}

// Interactive 1-5 selector. Filled vs empty differ by icon shape (star vs star-outline), not colour alone.
// Accessible as one adjustable control (swipe up/down, arrow keys) and as five focusable buttons.
export function StarInput({ value, onChange, size = 40, disabled }: InputProps) {
  const t = useTheme();
  const { tr } = useT();
  const styles = useMemo(() => createStyles(), []);
  const onKeyDown = (e: any) => {
    const key = e?.nativeEvent?.key ?? e?.key;
    if (key === 'ArrowRight' || key === 'ArrowUp') onChange(stepRating(value, 1));
    else if (key === 'ArrowLeft' || key === 'ArrowDown') onChange(stepRating(value, -1));
    else if (/^[1-5]$/.test(String(key))) onChange(Number(key));
    else return;
    e?.preventDefault?.();
  };

  return (
    <View
      style={styles.row}
      accessible={false}
      accessibilityRole="radiogroup"
      accessibilityLabel={tr('rating.starRating')}
      {...({ onKeyDown } as any)}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const selected = value >= n;
        return (
          <Pressable
            key={n}
            disabled={disabled}
            onPress={() => onChange(n)}
            hitSlop={4}
            style={({ pressed }) => [styles.star, { width: size + 8, height: size + 8 }, pressed && { opacity: 0.6 }]}
            accessibilityRole="radio"
            accessibilityLabel={`${tr('rating.starCount', { count: n })}, ${tr(`rating.label.${n}`)}`}
            accessibilityState={{ selected: value === n, disabled: !!disabled }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={(e) => onChange(stepRating(value, e.nativeEvent.actionName === 'increment' ? 1 : -1))}
          >
            <MaterialCommunityIcons
              name={selected ? 'star' : 'star-outline'}
              size={size}
              color={selected ? t.colors.star : t.colors.starEmpty}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    row: { flexDirection: 'row', justifyContent: 'center', gap: 2 },
    star: { alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  });
