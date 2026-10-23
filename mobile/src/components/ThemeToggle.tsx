import React from 'react';
import { StyleProp, TouchableOpacity, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme, useThemeStore } from '../theme';

interface Props {
  size?: number;
  style?: StyleProp<ViewStyle>;
}

// Sun/Moon switch between Catppuccin Latte and Mocha. Shared by User and Owner
// screens; it only writes the theme store, so screen state is never touched.
export default function ThemeToggle({ size = 22, style }: Props) {
  const t = useTheme();
  const toggle = useThemeStore((s) => s.toggle);
  return (
    <TouchableOpacity
      accessibilityRole="switch"
      accessibilityState={{ checked: t.isDark }}
      accessibilityLabel={t.isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      onPress={() => toggle(t.isDark)}
      style={[
        {
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: t.colors.surface,
          borderWidth: 1,
          borderColor: t.colors.border,
        },
        style,
      ]}
    >
      <MaterialCommunityIcons
        name={t.isDark ? 'white-balance-sunny' : 'weather-night'}
        size={size}
        color={t.colors.text}
      />
    </TouchableOpacity>
  );
}
