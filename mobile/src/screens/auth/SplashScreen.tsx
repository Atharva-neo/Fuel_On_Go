import React, { useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { fontSize } from '../../theme/stitch';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/AuthStack';
import { useAuthStore } from '../../store/authStore';
import { useLocationStore } from '../../store/locationStore';
import Logo from '../../components/Logo';
import { useTheme, type Theme } from '../../theme';

type SplashNav = NativeStackNavigationProp<AuthStackParamList, 'Splash'>;

export default function SplashScreen() {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const navigation = useNavigation<SplashNav>();
  const { isAuthenticated } = useAuthStore();
  const { isSet } = useLocationStore();

  const logoScale = useRef(new Animated.Value(0.5)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          useNativeDriver: true,
          damping: 12,
          stiffness: 100,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // After 2 seconds total animate, navigate
      setTimeout(() => {
        if (!isAuthenticated) {
          navigation.replace('Login');
        } else if (!isSet) {
          navigation.replace('LocationSetup');
        } else {
          // RootNavigator will handle this
          navigation.replace('Login');
        }
      }, 600);
    });
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}>
        <Logo size={132} />
      </Animated.View>
      <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
        Book CNG. Skip the queue.
      </Animated.Text>
    </View>
  );
}

const createStyles = (t: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logo: {
    fontSize: 80,
    marginBottom: 8,
  },
  name: {
    fontSize: fontSize.xxxl,
    fontWeight: '800',
    color: t.colors.text,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: fontSize.base,
    color: t.colors.brandText,
    fontWeight: '500',
  },
});
