import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '../i18n';
import { useTheme, type Theme } from '../theme';

export interface DropdownOption<V extends string> {
  value: V;
  label: string;
}

interface Props<V extends string> {
  /** Text on the closed control, e.g. the current choice. */
  display: string;
  /** Accessible name of the control (what it chooses). */
  accessibilityLabel: string;
  title: string;
  options: Array<DropdownOption<V>>;
  value: V;
  onChange: (v: V) => void;
}

/** A compact control that opens a list of choices. Used for secondary filters so the header stays calm. */
export default function DropdownSelect<V extends string>({ display, accessibilityLabel, title, options, value, onChange }: Props<V>) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const { tr } = useT();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${accessibilityLabel}: ${display}`}
        accessibilityHint={title}
      >
        <Text style={styles.triggerText} numberOfLines={1}>
          {display}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={18} color={t.colors.textSecondary} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel={tr('common.close')}>
          <Pressable style={[styles.sheet, { marginBottom: insets.bottom + 16 }]} onPress={() => {}}>
            <Text style={styles.title}>{title}</Text>
            <ScrollView bounces={false}>
              {options.map((o) => {
                const active = o.value === value;
                return (
                  <TouchableOpacity
                    key={o.value}
                    style={styles.option}
                    onPress={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.optionText, active && styles.optionTextActive]}>{o.label}</Text>
                    {active ? <MaterialCommunityIcons name="check" size={20} color={t.colors.brandText} /> : null}
                  </TouchableOpacity>
                );
              })}
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
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 40,
      paddingHorizontal: 14,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
      alignSelf: 'flex-start',
      maxWidth: '100%',
    },
    triggerText: { color: t.colors.text, fontWeight: '700', fontSize: 14, flexShrink: 1 },
    backdrop: { flex: 1, backgroundColor: t.colors.scrim, justifyContent: 'flex-end', paddingHorizontal: 16 },
    sheet: { backgroundColor: t.colors.surface, borderRadius: 16, padding: 8, maxHeight: '70%', borderWidth: 1, borderColor: t.colors.border },
    title: { color: t.colors.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, padding: 12 },
    option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52, paddingHorizontal: 12, gap: 12 },
    optionText: { color: t.colors.text, fontSize: 16, flex: 1 },
    optionTextActive: { color: t.colors.brandText, fontWeight: '800' },
  });
