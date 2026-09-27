import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors, radius, fontSize } from '../../theme/stitch';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
export type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: string;
  style?: StyleProp<ViewStyle>;
}

const variantMap = {
  success: { bg: colors.successBg, text: colors.success },
  warning: { bg: colors.warningBg, text: colors.warning },
  danger: { bg: colors.dangerBg, text: colors.danger },
  info: { bg: colors.infoBg, text: colors.secondary },
  neutral: { bg: colors.border, text: colors.textSecondary },
} as const;

const sizeMap = {
  sm: { px: 8, py: 3, fs: fontSize.xs },
  md: { px: 12, py: 5, fs: fontSize.sm },
} as const;

export default function Badge({ variant = 'neutral', size = 'md', children, style }: BadgeProps) {
  const v = variantMap[variant];
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

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.1,
  },
});
