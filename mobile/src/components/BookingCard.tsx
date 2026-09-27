import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../config/theme';
import type { LocalBooking } from '../store/bookingStore';

interface BookingCardProps {
  booking: LocalBooking;
  onPress: () => void;
}

function getStatusConfig(status: LocalBooking['status']) {
  switch (status) {
    case 'confirmed':
      return { label: 'Confirmed', bg: Colors.infoBg, color: Colors.info };
    case 'checked_in':
      return { label: 'Arrived', bg: Colors.successBg, color: Colors.success };
    case 'completed':
      return { label: 'Completed', bg: Colors.successBg, color: Colors.success };
    case 'cancelled':
      return { label: 'Cancelled', bg: Colors.surfaceElevated, color: Colors.textMuted };
    case 'expired':
      return { label: 'Expired', bg: Colors.errorBg, color: Colors.error };
    default:
      return { label: status, bg: Colors.surfaceElevated, color: Colors.textMuted };
  }
}

export default function BookingCard({ booking, onPress }: BookingCardProps) {
  const statusConfig = getStatusConfig(booking.status);

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

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  tokenBadge: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  tokenText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
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
    color: Colors.textPrimary,
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
    color: Colors.textSecondary,
  },
  dateRow: {
    flex: 1,
  },
  dateText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textMuted,
  },
  arrow: {
    fontSize: Typography.fontSize.xl,
    color: Colors.primary,
    marginTop: -2,
  },
});
