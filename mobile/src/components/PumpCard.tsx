import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Typography, Spacing, BorderRadius, Shadow } from '../config/theme';
import FuelQualityBadge from './FuelQualityBadge';
import { useTheme, type Theme } from '../theme';
// Legacy component — kept for compatibility with old HomeScreen usage
// Uses old pump API shape (availability, location, distance, queue)
interface OldPump {
  id: string;
  name: string;
  location: string;
  availability: 'HIGH' | 'MEDIUM' | 'LOW';
  queue: number;
  distance: string;
}

interface PumpCardProps {
  pump: OldPump;
  onPress: () => void;
  highlighted?: boolean;
  totalSlots?: number;
  availableSlots?: number;
}

export default function PumpCard({
  pump,
  onPress,
  highlighted = false,
  totalSlots,
  availableSlots,
}: PumpCardProps) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const getQueueColor = () => {
    switch (pump.availability) {
      case 'HIGH': return t.colors.successText;
      case 'MEDIUM': return t.colors.warningText;
      case 'LOW': return t.colors.dangerText;
      default: return t.colors.textMuted;
    }
  };

  return (
    <TouchableOpacity
      style={[styles.card, highlighted && styles.highlighted, Shadow.md]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {highlighted && (
        <View style={styles.bestBadge}>
          <Text style={styles.bestText}>⭐ Best for You</Text>
        </View>
      )}
      <View style={styles.row}>
        <View style={styles.iconWrapper}>
          <Text style={styles.icon}>⛽</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{pump.name}</Text>
          <Text style={styles.location} numberOfLines={1}>{pump.location}</Text>
        </View>
        <View style={styles.rightSection}>
          <Text style={styles.distance}>{pump.distance}</Text>
          <Text style={styles.arrow}>›</Text>
        </View>
      </View>
      <View style={styles.footer}>
        <FuelQualityBadge availability={pump.availability} />
        <View style={styles.queueInfo}>
          <Text style={[styles.queueCount, { color: getQueueColor() }]}>
            {pump.queue}
          </Text>
          <Text style={styles.queueLabel}> in queue</Text>
        </View>
        {availableSlots !== undefined && (
          <View style={styles.slotBadge}>
            <Text style={styles.slotText}>{availableSlots} slots</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (t: Theme) => StyleSheet.create({
  card: {
    backgroundColor: t.colors.surfaceRaised,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  highlighted: {
    borderColor: t.colors.brand,
    backgroundColor: t.colors.brandTint,
  },
  bestBadge: {
    backgroundColor: t.colors.brandTint,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginBottom: Spacing.sm,
  },
  bestText: {
    fontSize: Typography.fontSize.xs,
    color: t.colors.brandText,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: t.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 22,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
    color: t.colors.text,
    marginBottom: 2,
  },
  location: {
    fontSize: Typography.fontSize.sm,
    color: t.colors.textSecondary,
  },
  rightSection: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 4,
  },
  distance: {
    fontSize: Typography.fontSize.sm,
    color: t.colors.textSecondary,
  },
  arrow: {
    fontSize: Typography.fontSize.xl,
    color: t.colors.brandText,
    marginTop: -2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  queueInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  queueCount: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
  },
  queueLabel: {
    fontSize: Typography.fontSize.sm,
    color: t.colors.textSecondary,
  },
  slotBadge: {
    marginLeft: 'auto',
    backgroundColor: t.colors.infoTint,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  slotText: {
    fontSize: Typography.fontSize.xs,
    color: t.colors.infoText,
    fontWeight: '600',
  },
});
