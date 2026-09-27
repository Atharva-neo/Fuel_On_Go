import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors, radius, shadows } from '../../theme/stitch';

export type CardVariant = 'default' | 'elevated' | 'outlined';
export type CardPadding = 'sm' | 'md' | 'lg';

interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  padding?: CardPadding;
  style?: StyleProp<ViewStyle>;
}

const paddingMap = { sm: 10, md: 16, lg: 24 };

export default function Card({ children, variant = 'default', padding = 'md', style }: CardProps) {
  return (
    <View
      style={[
        styles.base,
        { padding: paddingMap[padding] },
        variant === 'elevated' && shadows.card,
        variant === 'outlined' && styles.outlined,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  outlined: {
    backgroundColor: colors.transparent,
    borderColor: colors.border,
  },
});
