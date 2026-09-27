import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../config/theme';
import FuelQualityBadge from './FuelQualityBadge';
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
  const getQueueColor = () => {
    switch (pump.availability) {
      case 'HIGH': return Colors.success;
      case 'MEDIUM': return Colors.warning;
      case 'LOW': return Colors.error;
      default: return Colors.textMuted;
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  highlighted: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(0,212,170,0.06)',
  },
  bestBadge: {
    backgroundColor: 'rgba(0,212,170,0.15)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginBottom: Spacing.sm,
  },
  bestText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
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
    backgroundColor: Colors.surface,
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
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  location: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  rightSection: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 4,
  },
  distance: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  arrow: {
    fontSize: Typography.fontSize.xl,
    color: Colors.primary,
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
    color: Colors.textSecondary,
  },
  slotBadge: {
    marginLeft: 'auto',
    backgroundColor: Colors.infoBg,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  slotText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.info,
    fontWeight: '600',
  },
});
