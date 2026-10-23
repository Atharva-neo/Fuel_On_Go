import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Typography, Spacing, BorderRadius } from '../config/theme';
import { useTheme, type Theme } from '../theme';
// Legacy component — kept for compatibility
interface OldSlot {
  time: string;
  capacity: number;
  booked: number;
  available?: number;
}

interface SlotGridProps {
  slots: OldSlot[];
  onSlotSelect: (slot: OldSlot & { index: number }) => void;
}

function isExpired(timeStr: string): boolean {
  const startTime = timeStr.split('-')[0];
  const [hours, minutes] = startTime.split(':').map(Number);
  const now = new Date();
  const slotDate = new Date();
  slotDate.setHours(hours, minutes, 0, 0);
  return slotDate.getTime() < now.getTime();
}

function getSlotStatus(slot: OldSlot, timeStr: string) {
  if (isExpired(timeStr)) return 'expired';
  const available = slot.capacity - slot.booked;
  if (available === 0) return 'full';
  if (available <= 2) return 'limited';
  return 'available';
}

export default function SlotGrid({ slots, onSlotSelect }: SlotGridProps) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  if (!slots.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No slots available</Text>
      </View>
    );
  }

  const rows: OldSlot[][] = [];
  for (let i = 0; i < slots.length; i += 3) {
    rows.push(slots.slice(i, i + 3));
  }

  return (
    <View style={styles.container}>
      {slots.map((slot, index) => {
        const status = getSlotStatus(slot, slot.time);
        const available = slot.capacity - slot.booked;
        const disabled = status === 'full' || status === 'expired';

        return (
          <TouchableOpacity
            key={`${slot.time}-${index}`}
            style={[
              styles.slot,
              status === 'available' && styles.slotAvailable,
              status === 'limited' && styles.slotLimited,
              status === 'full' && styles.slotFull,
              status === 'expired' && styles.slotExpired,
            ]}
            onPress={() => !disabled && onSlotSelect({ ...slot, index })}
            disabled={disabled}
            activeOpacity={0.75}
          >
            <Text
              style={[
                styles.slotTime,
                status === 'expired' && styles.slotTimeExpired,
                status === 'full' && styles.slotTimeFull,
              ]}
            >
              {slot.time.split('-')[0]}
            </Text>
            <Text style={[styles.slotCount, disabled && styles.slotCountFull]}>
              {status === 'expired'
                ? 'Expired'
                : status === 'full'
                ? 'Full'
                : `${available} left`}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const createStyles = (t: Theme) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  slot: {
    width: '30%',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    minWidth: 90,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  slotAvailable: {
    backgroundColor: t.colors.successTint,
    borderColor: t.colors.success,
  },
  slotLimited: {
    backgroundColor: t.colors.warningTint,
    borderColor: t.colors.warning,
  },
  slotFull: {
    backgroundColor: t.colors.surfaceRaised,
    borderColor: t.colors.border,
  },
  slotExpired: {
    backgroundColor: t.colors.surfaceRaised,
    borderColor: t.colors.border,
    opacity: 0.5,
  },
  slotTime: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    color: t.colors.text,
    marginBottom: 2,
  },
  slotTimeExpired: {
    textDecorationLine: 'line-through',
    color: t.colors.textMuted,
  },
  slotTimeFull: {
    color: t.colors.textMuted,
  },
  slotCount: {
    fontSize: Typography.fontSize.xs,
    color: t.colors.textSecondary,
  },
  slotCountFull: {
    color: t.colors.textMuted,
  },
  empty: {
    padding: Spacing.xxxl,
    alignItems: 'center',
  },
  emptyText: {
    color: t.colors.textSecondary,
    fontSize: Typography.fontSize.base,
  },
});
