import React from 'react';
import { Image, StyleProp, ImageStyle } from 'react-native';

// The Fuel on Go app logo (same artwork as the launcher icon). One component so
// every screen uses the same asset: assets/logo.png (512 px, transparent corners).
export default function Logo({ size = 96, style }: { size?: number; style?: StyleProp<ImageStyle> }) {
  return (
    <Image
      source={require('../../assets/logo.png')}
      style={[{ width: size, height: size, resizeMode: 'contain' }, style]}
      accessibilityRole="image"
      accessibilityLabel="Fuel on Go logo"
    />
  );
}
