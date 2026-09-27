import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../config/theme';

interface QRDisplayProps {
  qrToken: string | null;
  loading?: boolean;
}

export default function QRDisplay({ qrToken, loading }: QRDisplayProps) {
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
          backgroundColor={Colors.white}
          color={Colors.background}
        />
      </View>
      <View style={styles.labelWrapper}>
        <Text style={styles.lightning}>⚡</Text>
        <Text style={styles.label}>Fuel on Go</Text>
      </View>
      <Text style={styles.tokenText} numberOfLines={1}>
        Token: {qrToken}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  qrWrapper: {
    backgroundColor: Colors.white,
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
    color: Colors.textPrimary,
  },
  tokenText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
    fontFamily: 'monospace',
  },
  skeleton: {
    gap: Spacing.md,
  },
  skeletonBox: {
    width: 220,
    height: 220,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
  },
  loadingText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textMuted,
  },
});
