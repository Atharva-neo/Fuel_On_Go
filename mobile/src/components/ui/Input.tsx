import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardTypeOptions,
  StyleProp,
  ViewStyle,
  TouchableOpacity,
} from 'react-native';
import { radius, fontSize } from '../../theme/stitch';
import { useTheme, type Theme } from '../../theme';

interface InputProps {
  label?: string;
  placeholder?: string;
  error?: string;
  leftIcon?: string;
  rightIcon?: string;
  onRightIconPress?: () => void;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  value: string;
  onChangeText: (text: string) => void;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  maxLength?: number;
  editable?: boolean;
  style?: StyleProp<ViewStyle>;
  returnKeyType?: 'done' | 'next' | 'search' | 'send';
  onSubmitEditing?: () => void;
  prefix?: string;
}

export default function Input({
  label,
  placeholder,
  error,
  leftIcon,
  rightIcon,
  onRightIconPress,
  secureTextEntry,
  keyboardType,
  value,
  onChangeText,
  autoCapitalize,
  maxLength,
  editable = true,
  style,
  returnKeyType,
  onSubmitEditing,
  prefix,
}: InputProps) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.wrapper, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.inputContainer,
          focused && styles.focused,
          !!error && styles.errored,
          !editable && styles.disabled,
        ]}
      >
        {leftIcon ? <Text style={styles.icon}>{leftIcon}</Text> : null}
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={t.colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          maxLength={maxLength}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          selectionColor={t.colors.brandText}
        />
        {rightIcon ? (
          <TouchableOpacity onPress={onRightIconPress} disabled={!onRightIconPress}>
            <Text style={styles.icon}>{rightIcon}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const createStyles = (t: Theme) => StyleSheet.create({
  wrapper: {
    marginBottom: 14,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: t.colors.textSecondary,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.colors.inputBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: t.colors.border,
    paddingHorizontal: 12,
    height: 52,
    gap: 8,
  },
  focused: {
    borderColor: t.colors.brand,
  },
  errored: {
    borderColor: t.colors.danger,
  },
  disabled: {
    opacity: 0.5,
  },
  icon: {
    fontSize: 18,
    color: t.colors.textMuted,
  },
  prefix: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: t.colors.text,
    paddingRight: 8,
    borderRightWidth: 1,
    borderRightColor: t.colors.border,
  },
  input: {
    flex: 1,
    fontSize: fontSize.base,
    color: t.colors.text,
    height: '100%',
  },
  error: {
    fontSize: fontSize.xs,
    color: t.colors.dangerText,
    marginTop: 4,
  },
});
