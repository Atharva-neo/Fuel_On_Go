import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { fontSize } from '../theme/stitch';
import { useTheme, type Theme } from '../theme';
import Logo from '../components/Logo';

export default function SplashScreen() {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  return (
    <View style={styles.container}>
      <Logo size={132} />
      <ActivityIndicator color={t.colors.brandText} style={{ marginTop: 16 }} />
    </View>
  );
}

const createStyles = (t: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.colors.bg, // Dark background for splash
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    fontSize: 72,
    color: t.colors.infoText,
  },
  title: {
    marginTop: 8,
    fontSize: 32,
    color: t.colors.text,
    fontWeight: '800',
  },
});
