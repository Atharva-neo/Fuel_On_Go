import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import { Colors, Typography, Spacing } from '../config/theme';

interface TrustScoreMeterProps {
  score: number;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

export default function TrustScoreMeter({ score }: TrustScoreMeterProps) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const size = 120;
  const cx = size / 2;
  const cy = size / 2;
  const r = 44;
  const startAngle = -130;
  const maxAngle = 130;
  const endAngle = startAngle + (clampedScore / 100) * (maxAngle * 2);

  const color =
    clampedScore >= 70 ? Colors.success : clampedScore >= 40 ? Colors.warning : Colors.error;

  const trackPath = describeArc(cx, cy, r, startAngle, startAngle + maxAngle * 2);
  const scorePath = clampedScore > 0 ? describeArc(cx, cy, r, startAngle, endAngle) : '';

  return (
    <View style={styles.container}>
      <Svg width={size} height={size}>
        <Path d={trackPath} stroke={Colors.surfaceBorder} strokeWidth="8" fill="none" strokeLinecap="round" />
        {clampedScore > 0 && (
          <Path d={scorePath} stroke={color} strokeWidth="8" fill="none" strokeLinecap="round" />
        )}
      </Svg>
      <View style={styles.centerLabel}>
        <Text style={[styles.score, { color }]}>{clampedScore}</Text>
      </View>
      <Text style={styles.label}>Trust Score</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  centerLabel: {
    position: 'absolute',
    top: 30,
    alignItems: 'center',
    justifyContent: 'center',
    width: 120,
  },
  score: {
    fontSize: Typography.fontSize.xxl,
    fontWeight: '800',
  },
  label: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
});
