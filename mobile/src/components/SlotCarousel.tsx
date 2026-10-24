import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme, type Theme } from '../theme';
import { useT } from '../i18n';

interface Slot {
  id: string | number;
  start_time: string;
  end_time: string;
  capacity?: number;
  max_capacity?: number;
  booked_count?: number;
  available_capacity?: number;
  status?: string;
  is_deactivated?: boolean;
  deactivation_reason?: string;
  date?: string;
  slot_date?: string;
}

interface SlotCarouselProps {
  slots: Slot[];
  selectedSlotId?: string | number | null;
  onSelect: (slot: Slot) => void;
  onLongPress?: (slot: Slot) => void;
}

export default function SlotCarousel({ slots, selectedSlotId, onSelect, onLongPress }: SlotCarouselProps) {
  const t = useTheme();
  const { tr, fmt } = useT();
  const styles = useMemo(() => createStyles(t), [t]);
  const now = new Date();

  const isBookable = (slot: Slot) => {
    if (slot.status === 'deactivated' || slot.is_deactivated) return false;
    const cap = Number(slot.capacity ?? slot.max_capacity ?? 0);
    const booked = Number(slot.booked_count ?? cap - Number(slot.available_capacity ?? cap));
    if (booked >= cap) return false;
    const slotStart = new Date(`${slot.slot_date || slot.date}T${slot.start_time}`);
    if (Number.isFinite(slotStart.getTime()) && slotStart.getTime() < now.getTime()) return false;
    return true;
  };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.container}>
      {slots.map((slot) => {
        const cap = Number(slot.capacity ?? slot.max_capacity ?? 0);
        const booked = Number(slot.booked_count ?? cap - Number(slot.available_capacity ?? cap));
        const left = Math.max(0, cap - booked);

        const slotStart = new Date(`${slot.slot_date || slot.date}T${slot.start_time}`);
        const isPast = Number.isFinite(slotStart.getTime()) && slotStart.getTime() < now.getTime();
        const isDeactivated = slot.status === 'deactivated' || slot.is_deactivated;
        const isFull = left <= 0;

        const available = !isPast && !isDeactivated && !isFull;
        const isSelected = selectedSlotId === slot.id;

        return (
          <TouchableOpacity
            key={slot.id}
            style={[
              styles.slotTile,
              available && styles.slotAvailable,
              isFull && styles.slotFull,
              isPast && styles.slotPast,
              isDeactivated && styles.slotDeactivated,
              isSelected && styles.slotSelected,
            ]}
            disabled={!available && !isDeactivated} // Allow long press on deactivated if needed
            onPress={() => available && onSelect(slot)}
            onLongPress={() => onLongPress && onLongPress(slot)}
          >
            <Text style={[
              styles.timeText,
              isPast && styles.strike,
              isSelected && styles.timeTextSelected,
              (!available && !isSelected) && styles.timeTextDisabled
            ]}>
              {fmt.clock(String(slot.start_time))}
            </Text>
            <Text style={[
              styles.metaText,
              isSelected && styles.metaTextSelected,
              (!available && !isSelected) && styles.metaTextDisabled
            ]}>
              {isDeactivated ? tr('slot.unavailable') : isFull ? tr('slot.full') : tr('slot.left', { count: left })}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const createStyles = (t: Theme) => StyleSheet.create({
  container: {
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  slotTile: {
    width: 90,
    height: 64,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.surface,
    shadowColor: t.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  slotAvailable: {
    borderColor: t.colors.brand,
  },
  slotSelected: {
    backgroundColor: t.colors.brand,
    borderColor: t.colors.brand,
    shadowOpacity: 0.15,
    elevation: 4,
  },
  slotFull: {
    backgroundColor: t.colors.surfaceAlt,
    borderColor: t.colors.border,
  },
  slotPast: {
    backgroundColor: t.colors.surfaceAlt,
    borderColor: t.colors.border,
  },
  slotDeactivated: {
    backgroundColor: t.colors.surfaceAlt,
    borderColor: t.colors.border,
  },
  timeText: {
    fontSize: 16,
    fontWeight: '800',
    color: t.colors.text,
    marginBottom: 2,
  },
  timeTextSelected: {
    color: t.colors.onBrand,
  },
  timeTextDisabled: {
    color: t.colors.textMuted,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '600',
    color: t.colors.brandText,
  },
  metaTextSelected: {
    color: t.colors.onBrand,
  },
  metaTextDisabled: {
    color: t.colors.textMuted,
  },
  strike: {
    textDecorationLine: 'line-through',
    color: t.colors.textMuted,
  },
});
