import React, { useMemo } from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { radius, fontSize } from '../../theme/stitch';
import { useTheme, type Theme } from '../../theme';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
export type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: string;
  style?: StyleProp<ViewStyle>;
}

const variantMap = (t: Theme) =>
  ({
    success: { bg: t.colors.successTint, text: t.colors.successText },
    warning: { bg: t.colors.warningTint, text: t.colors.warningText },
    danger: { bg: t.colors.dangerTint, text: t.colors.dangerText },
    info: { bg: t.colors.infoTint, text: t.colors.infoText },
    neutral: { bg: t.colors.border, text: t.colors.textSecondary },
  }) as const;

const sizeMap = {
  sm: { px: 8, py: 3, fs: fontSize.xs },
  md: { px: 12, py: 5, fs: fontSize.sm },
} as const;

export default function Badge({ variant = 'neutral', size = 'md', children, style }: BadgeProps) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const v = variantMap(t)[variant];
  const s = sizeMap[size];
  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: v.bg,
          paddingHorizontal: s.px,
          paddingVertical: s.py,
        },
        style,
      ]}
    >
      <Text style={[styles.text, { color: v.text, fontSize: s.fs }]}>{children}</Text>
    </View>
  );
}

const createStyles = (t: Theme) => StyleSheet.create({
  base: {
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.1,
  },
});
