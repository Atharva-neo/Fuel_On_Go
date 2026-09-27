import React, { useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
  View,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { colors, radius, fontSize } from '../../theme/stitch';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'full';

interface ButtonProps {
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: string;
  rightIcon?: string;
  children: string;
  style?: StyleProp<ViewStyle>;
}

const variantStyles = {
  primary: { bg: colors.primary, text: colors.white, border: 'transparent' },
  secondary: { bg: colors.bgInput, text: colors.white, border: 'transparent' },
  outline: { bg: 'transparent', text: colors.primary, border: colors.primary },
  danger: { bg: colors.danger, text: colors.white, border: 'transparent' },
  ghost: { bg: 'transparent', text: colors.primary, border: 'transparent' },
} as const;

const sizeStyles = {
  sm: { height: 36, px: 14, fs: fontSize.sm },
  md: { height: 48, px: 20, fs: fontSize.base },
  lg: { height: 56, px: 28, fs: fontSize.md },
  full: { height: 56, px: 20, fs: fontSize.md },
} as const;

export default function Button({
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  children,
  style,
}: ButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const v = variantStyles[variant];
  const s = sizeStyles[size];

  const onPressIn = () => {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start();
  };
  const onPressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }).start();
  };

  const isDisabled = disabled || loading;

  return (
    <Animated.View style={[{ transform: [{ scale }] }, size === 'full' && styles.fullWidth, style]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={isDisabled}
        activeOpacity={0.9}
        style={[
          styles.base,
          {
            backgroundColor: v.bg,
            height: s.height,
            paddingHorizontal: s.px,
            borderRadius: radius.md,
            borderWidth: v.border !== 'transparent' ? 1.5 : 0,
            borderColor: v.border,
            opacity: isDisabled ? 0.45 : 1,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={v.text} size="small" />
        ) : (
          <View style={styles.row}>
            {leftIcon ? <Text style={styles.icon}>{leftIcon}</Text> : null}
            <Text style={[styles.label, { color: v.text, fontSize: s.fs }]}>{children}</Text>
            {rightIcon ? <Text style={styles.icon}>{rightIcon}</Text> : null}
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  icon: {
    fontSize: 16,
  },
});
