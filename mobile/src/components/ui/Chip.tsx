import React, { useMemo } from 'react';
import { TouchableOpacity, Text, StyleSheet, View, StyleProp, ViewStyle } from 'react-native';
import { radius, fontSize } from '../../theme/stitch';
import { useTheme, type Theme } from '../../theme';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function Chip({ label, selected = false, onPress, icon, disabled, style }: ChipProps) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
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

const createStyles = (t: Theme) => StyleSheet.create({
  base: {
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
  },
  selected: {
    backgroundColor: t.colors.brand,
    borderColor: t.colors.brand,
  },
  unselected: {
    backgroundColor: t.colors.inputBg,
    borderColor: t.colors.border,
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
    color: t.colors.onBrand,
  },
  labelUnselected: {
    color: t.colors.textSecondary,
  },
});
