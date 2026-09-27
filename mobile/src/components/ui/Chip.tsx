import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View, StyleProp, ViewStyle } from 'react-native';
import { colors, radius, fontSize } from '../../theme/stitch';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function Chip({ label, selected = false, onPress, icon, disabled, style }: ChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
      style={[
        styles.base,
        selected ? styles.selected : styles.unselected,
        disabled && styles.disabled,
        style,
      ]}
    >
      <View style={styles.inner}>
        {icon ? <Text style={styles.icon}>{icon}</Text> : null}
        <Text style={[styles.label, selected ? styles.labelSelected : styles.labelUnselected]}>
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
  },
  selected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  unselected: {
    backgroundColor: colors.bgInput,
    borderColor: colors.border,
  },
  disabled: {
    opacity: 0.4,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  icon: {
    fontSize: 14,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  labelSelected: {
    color: colors.white,
  },
  labelUnselected: {
    color: colors.textSecondary,
  },
});
