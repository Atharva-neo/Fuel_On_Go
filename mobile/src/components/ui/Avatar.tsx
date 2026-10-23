import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { radius, fontSize } from '../../theme/stitch';
import { WHITE, contrastRatio, latte, mocha, useTheme, type Theme } from '../../theme';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  name: string;
  size?: AvatarSize;
}

// Initial-badge colours come from the active Catppuccin theme (brand green first).
function paletteFor(t: Theme): string[] {
  const c = t.isDark ? mocha : latte;
  return [t.colors.brand, t.colors.info, t.colors.warning, t.colors.danger, c.mauve, c.pink];
}

function getColor(name: string, t: Theme): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const palette = paletteFor(t);
  return palette[Math.abs(hash) % palette.length];
}

// Pick whichever of dark/light text reads better on the badge colour.
function readableOn(bg: string): string {
  return contrastRatio(mocha.crust, bg) >= contrastRatio(WHITE, bg) ? mocha.crust : WHITE;
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('');
}

const sizeMap = {
  sm: { dim: 32, fs: fontSize.xs },
  md: { dim: 44, fs: fontSize.sm },
  lg: { dim: 64, fs: fontSize.lg },
  xl: { dim: 80, fs: fontSize.xl },
} as const;

export default function Avatar({ name, size = 'md' }: AvatarProps) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const s = sizeMap[size];
  const bg = getColor(name, t);
  const initials = getInitials(name);

  return (
    <View
      style={[
        styles.base,
        {
          width: s.dim,
          height: s.dim,
          borderRadius: s.dim / 2,
          backgroundColor: bg,
        },
      ]}
    >
      <Text style={[styles.text, { fontSize: s.fs, color: readableOn(bg) }]}>{initials}</Text>
    </View>
  );
}

const createStyles = (t: Theme) => StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: t.colors.text,
    fontWeight: '800',
  },
});
