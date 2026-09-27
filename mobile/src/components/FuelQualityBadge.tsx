import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../config/theme';

interface FuelQualityBadgeProps {
  availability: 'HIGH' | 'MEDIUM' | 'LOW';
}

export default function FuelQualityBadge({ availability }: FuelQualityBadgeProps) {
  const getConfig = () => {
    switch (availability) {
      case 'HIGH':
        return { label: 'High Avail.', bg: Colors.successBg, color: Colors.success };
      case 'MEDIUM':
        return { label: 'Medium', bg: Colors.warningBg, color: Colors.warning };
      case 'LOW':
        return { label: 'Low Avail.', bg: Colors.errorBg, color: Colors.error };
      default:
        return { label: 'Unknown', bg: Colors.surfaceElevated, color: Colors.textMuted };
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

const styles = StyleSheet.create({
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
