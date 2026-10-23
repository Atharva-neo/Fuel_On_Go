import React, { useMemo } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { radius, shadows } from '../../theme/stitch';
import { useTheme, type Theme } from '../../theme';

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
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
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

const createStyles = (t: Theme) => StyleSheet.create({
  base: {
    backgroundColor: t.colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  outlined: {
    backgroundColor: 'transparent',
    borderColor: t.colors.border,
  },
});
