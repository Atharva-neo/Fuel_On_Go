import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, fontSize } from '../../theme/stitch';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  name: string;
  size?: AvatarSize;
}

const PALETTE = [
  '#00c896', '#4A90E2', '#ff9f43', '#ff4757',
  '#a29bfe', '#fd79a8',
];

function getColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
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
  const s = sizeMap[size];
  const bg = getColor(name);
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
      <Text style={[styles.text, { fontSize: s.fs }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: colors.white,
    fontWeight: '800',
  },
});
