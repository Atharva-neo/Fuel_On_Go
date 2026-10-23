import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Typography, Spacing, BorderRadius, Shadow } from '../config/theme';
import Logo from './Logo';
import { useTheme, type Theme } from '../theme';

interface QRDisplayProps {
  qrToken: string | null;
  loading?: boolean;
}

export default function QRDisplay({ qrToken, loading }: QRDisplayProps) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  if (loading || !qrToken) {
    return (
      <View style={[styles.container, styles.skeleton]}>
        <View style={styles.skeletonBox} />
        <Text style={styles.loadingText}>
          {loading ? 'Generating QR...' : 'No QR available'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.qrWrapper, Shadow.lg]}>
        <QRCode
          value={qrToken}
          size={200}
          backgroundColor={t.colors.qrBackground}
          color={t.colors.qrForeground}
        />
      </View>
      <View style={styles.labelWrapper}>
        <Logo size={20} />
        <Text style={styles.label}>Fuel on Go</Text>
      </View>
      <Text style={styles.tokenText} numberOfLines={1}>
        Token: {qrToken}
      </Text>
    </View>
  );
}

const createStyles = (t: Theme) => StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  qrWrapper: {
    backgroundColor: t.colors.qrBackground,
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  labelWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.xs,
  },
  lightning: {
    fontSize: Typography.fontSize.base,
  },
  label: {
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
    color: t.colors.text,
  },
  tokenText: {
    fontSize: Typography.fontSize.xs,
    color: t.colors.textMuted,
    fontFamily: 'monospace',
  },
  skeleton: {
    gap: Spacing.md,
  },
  skeletonBox: {
    width: 220,
    height: 220,
    backgroundColor: t.colors.surfaceRaised,
    borderRadius: BorderRadius.lg,
  },
  loadingText: {
    fontSize: Typography.fontSize.sm,
    color: t.colors.textMuted,
  },
});
