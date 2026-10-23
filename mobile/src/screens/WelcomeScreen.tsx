import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LightningIcon, CarIcon, UserIcon } from '../components/ui/Icons';
import ThemeToggle from '../components/ThemeToggle';
import Logo from '../components/Logo';
import { useTheme, type Theme } from '../theme';

export default function WelcomeScreen({ navigation }: any) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  return (
    <View style={styles.container}>
      {/* Background radial blobs simulated */}
      <View style={styles.blob1} />
      <View style={styles.blob2} />

      <View style={styles.themeToggle}>
        <ThemeToggle />
      </View>

      <View style={styles.content}>
        <Logo size={132} style={{ marginBottom: 20 }} />
        <Text style={styles.tagline}>Book your CNG slot. Skip the queue.</Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('UserAuth')}>
          <CarIcon size={20} color={t.colors.text} />
          <Text style={styles.primaryText} numberOfLines={1}>
            I'm a Vehicle Owner
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('AdminAuth')}>
          <UserIcon size={20} color={t.colors.onInverse} />
          <Text style={styles.secondaryText} numberOfLines={1}>
            I'm a Pump Owner
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (t: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.colors.bg,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  blob1: {
    position: 'absolute',
    top: -100,
    left: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: t.colors.brandTint,
    transform: [{ scale: 1.5 }],
  },
  blob2: {
    position: 'absolute',
    bottom: -150,
    right: -100,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: t.colors.surfaceAlt,
    zIndex: 0,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    zIndex: 2,
  },
  themeToggle: {
    position: 'absolute',
    top: 52,
    right: 20,
    zIndex: 5,
  },
  logoContainer: {
    width: 80,
    height: 80,
    backgroundColor: t.colors.brandTint,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: t.colors.brand,
  },
  title: {
    fontSize: 42,
    fontWeight: '900',
    color: t.colors.text,
    letterSpacing: -1.5,
  },
  tagline: {
    marginTop: 12,
    fontSize: 16,
    color: t.colors.textMuted,
    letterSpacing: -0.2,
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    zIndex: 2,
  },
  primaryButton: {
    backgroundColor: t.colors.brand,
    flexDirection: 'row',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 12,
  },
  primaryText: {
    color: t.colors.text,
    fontWeight: '800',
    fontSize: 16,
    flexShrink: 1,
    paddingRight: 2,
  },
  secondaryButton: {
    backgroundColor: t.colors.inverse,
    flexDirection: 'row',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: t.colors.border,
    gap: 12,
  },
  secondaryText: {
    color: t.colors.onInverse,
    fontWeight: '800',
    fontSize: 16,
    flexShrink: 1,
    paddingRight: 2, // Android can clip the last glyph of a bold label without this
  },
});

