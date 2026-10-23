import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Typography, Spacing, BorderRadius } from '../config/theme';
import { useTheme, type Theme } from '../theme';

interface FuelQualityBadgeProps {
  availability: 'HIGH' | 'MEDIUM' | 'LOW';
}

export default function FuelQualityBadge({ availability }: FuelQualityBadgeProps) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const getConfig = () => {
    switch (availability) {
      case 'HIGH':
        return { label: 'High Avail.', bg: t.colors.successTint, color: t.colors.successText };
      case 'MEDIUM':
        return { label: 'Medium', bg: t.colors.warningTint, color: t.colors.warningText };
      case 'LOW':
        return { label: 'Low Avail.', bg: t.colors.dangerTint, color: t.colors.dangerText };
      default:
        return { label: 'Unknown', bg: t.colors.surfaceRaised, color: t.colors.textMuted };
    }
  };

  const config = getConfig();

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <View style={[styles.dot, { backgroundColor: config.color }]} />
      <Text style={[styles.text, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const createStyles = (t: Theme) => StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '600',
  },
});
