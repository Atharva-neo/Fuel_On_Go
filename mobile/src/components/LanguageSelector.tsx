import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LANGUAGES, langStore, useT, type Language } from '../i18n';
import { useTheme, type Theme } from '../theme';

interface Props {
  /** Smaller chips, no label (used on the welcome screen). */
  compact?: boolean;
}

/** English / हिन्दी / मराठी. Each name is shown in its own script so it is readable in any language. */
export default function LanguageSelector({ compact }: Props) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t, !!compact), [t, compact]);
  const { tr, language } = useT();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={tr('settings.language')} style={styles.row}>
      {LANGUAGES.map((l) => {
        const active = l.code === language;
        return (
          <TouchableOpacity
            key={l.code}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => langStore.getState().setLanguage(l.code as Language)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={l.native}
          >
            <Text style={[styles.text, active && styles.textActive]} numberOfLines={1}>
              {l.native}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const createStyles = (t: Theme, compact: boolean) =>
  StyleSheet.create({
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      minHeight: compact ? 36 : 44,
      minWidth: compact ? 0 : 92,
      paddingHorizontal: compact ? 12 : 16,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipActive: { backgroundColor: t.colors.brandTint, borderColor: t.colors.brand },
    text: { color: t.colors.textSecondary, fontWeight: '700', fontSize: compact ? 13 : 15 },
    textActive: { color: t.colors.brandText, fontWeight: '800' },
  });
