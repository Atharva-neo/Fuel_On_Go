import React, { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LanguageSelector from './LanguageSelector';
import { useT } from '../i18n';
import { useAuthStore } from '../store/authStore';
import { useTheme, useThemeStore, type Theme, type ThemePreference } from '../theme';

interface Props {
  /** Style for the round trigger button (position it where the screen needs it). */
  style?: StyleProp<ViewStyle>;
  /** Where the sheet sits below the top inset, in px. */
  offsetTop?: number;
}

const THEME_OPTIONS: Array<{ value: ThemePreference; key: string; icon: string }> = [
  { value: 'light', key: 'settings.themeLight', icon: 'white-balance-sunny' },
  { value: 'dark', key: 'settings.themeDark', icon: 'weather-night' },
  { value: 'system', key: 'settings.themeSystem', icon: 'cellphone' },
];

/**
 * One menu for the secondary, infrequent actions: theme, language, help, log out.
 * Primary actions (search, recenter, book, scan) stay on screen.
 */
export default function OverflowMenu({ style, offsetTop = 56 }: Props) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const { tr } = useT();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);

  const confirmLogout = () => {
    setOpen(false);
    Alert.alert(tr('menu.logoutTitle'), tr('menu.logoutBody'), [
      { text: tr('common.cancel'), style: 'cancel' },
      { text: tr('menu.logout'), style: 'destructive', onPress: () => useAuthStore.getState().logout() },
    ]);
  };

  const showHelp = () => {
    setOpen(false);
    Alert.alert(tr('settings.help'), `${tr('profile.callUs')}\n${tr('profile.hours')}`, [{ text: tr('common.ok') }]);
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.trigger, style]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={tr('menu.more')}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      >
        <MaterialCommunityIcons name="dots-vertical" size={22} color={t.colors.text} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel={tr('common.close')}>
          <Pressable
            style={[styles.sheet, { marginTop: insets.top + offsetTop, marginBottom: insets.bottom + 12, maxHeight: '80%' }]}
            onPress={() => {}}
          >
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              <Text style={styles.section}>{tr('settings.theme')}</Text>
              <View style={styles.themeRow}>
                {THEME_OPTIONS.map((o) => {
                  const active = preference === o.value;
                  return (
                    <TouchableOpacity
                      key={o.value}
                      style={[styles.themeChip, active && styles.themeChipActive]}
                      onPress={() => setPreference(o.value)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                    >
                      <MaterialCommunityIcons name={o.icon as any} size={16} color={active ? t.colors.brandText : t.colors.textSecondary} />
                      <Text style={[styles.themeText, active && styles.themeTextActive]} numberOfLines={1}>
                        {tr(o.key)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.section}>{tr('settings.language')}</Text>
              <LanguageSelector compact />

              <View style={styles.divider} />

              <TouchableOpacity style={styles.item} onPress={showHelp} accessibilityRole="button">
                <MaterialCommunityIcons name="help-circle-outline" size={20} color={t.colors.textSecondary} />
                <Text style={styles.itemText}>{tr('settings.help')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.item} onPress={confirmLogout} accessibilityRole="button">
                <MaterialCommunityIcons name="logout" size={20} color={t.colors.dangerText} />
                <Text style={[styles.itemText, { color: t.colors.dangerText }]}>{tr('menu.logout')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    trigger: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: t.colors.mapControlBg,
      borderWidth: 1,
      borderColor: t.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backdrop: { flex: 1, alignItems: 'flex-end', paddingHorizontal: 14 },
    sheet: {
      width: '88%',
      maxWidth: 340,
      backgroundColor: t.colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.colors.border,
      padding: 16,
      elevation: 8,
    },
    section: { color: t.colors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 8, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.6 },
    themeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
    themeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 36,
      paddingHorizontal: 12,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    themeChipActive: { backgroundColor: t.colors.brandTint, borderColor: t.colors.brand },
    themeText: { color: t.colors.textSecondary, fontWeight: '700', fontSize: 13, flexShrink: 1 },
    themeTextActive: { color: t.colors.brandText, fontWeight: '800' },
    divider: { height: 1, backgroundColor: t.colors.border, marginVertical: 14 },
    item: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
    itemText: { color: t.colors.text, fontSize: 15, fontWeight: '600', flex: 1 },
  });
