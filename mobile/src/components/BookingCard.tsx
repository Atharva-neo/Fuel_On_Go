import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Typography, Spacing, BorderRadius, Shadow } from '../config/theme';
import type { LocalBooking } from '../store/bookingStore';
import { useTheme, type Theme } from '../theme';

interface BookingCardProps {
  booking: LocalBooking;
  onPress: () => void;
}

function getStatusConfig(status: LocalBooking['status'], t: Theme) {
  switch (status) {
    case 'confirmed':
      return { label: 'Confirmed', bg: t.colors.infoTint, color: t.colors.infoText };
    case 'checked_in':
      return { label: 'Arrived', bg: t.colors.successTint, color: t.colors.successText };
    case 'completed':
      return { label: 'Completed', bg: t.colors.successTint, color: t.colors.successText };
    case 'cancelled':
      return { label: 'Cancelled', bg: t.colors.surfaceRaised, color: t.colors.textMuted };
    case 'expired':
      return { label: 'Expired', bg: t.colors.dangerTint, color: t.colors.dangerText };
    default:
      return { label: status, bg: t.colors.surfaceRaised, color: t.colors.textMuted };
  }
}

export default function BookingCard({ booking, onPress }: BookingCardProps) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const statusConfig = getStatusConfig(booking.status, t);

  const formattedDate = new Date(booking.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });

  return (
    <TouchableOpacity
      style={[styles.card, Shadow.sm]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.header}>
        <View style={styles.tokenBadge}>
          <Text style={styles.tokenText}>#{booking.tokenNumber}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
          <Text style={[styles.statusText, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
        </View>
      </View>
      <Text style={styles.pumpName} numberOfLines={1}>{booking.pumpName}</Text>
      <View style={styles.footer}>
        <View style={styles.timeRow}>
          <Text style={styles.timeIcon}>🕐</Text>
          <Text style={styles.slotTime}>{booking.slotTime}</Text>
        </View>
        <View style={styles.dateRow}>
          <Text style={styles.dateText}>{formattedDate}</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  tokenBadge: {
    backgroundColor: t.colors.surface,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  tokenText: {
    fontSize: Typography.fontSize.xs,
    color: t.colors.textSecondary,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  statusBadge: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
  },
  pumpName: {
    fontSize: Typography.fontSize.md,
    fontWeight: '700',
    color: t.colors.text,
    marginBottom: Spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeIcon: {
    fontSize: 13,
  },
  slotTime: {
    fontSize: Typography.fontSize.sm,
    color: t.colors.textSecondary,
  },
  dateRow: {
    flex: 1,
  },
  dateText: {
    fontSize: Typography.fontSize.sm,
    color: t.colors.textMuted,
  },
  arrow: {
    fontSize: Typography.fontSize.xl,
    color: t.colors.brandText,
    marginTop: -2,
  },
});
