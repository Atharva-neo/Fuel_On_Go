import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors, fontSize } from '../../theme/stitch';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/AuthStack';
import { useAuthStore } from '../../store/authStore';
import { useLocationStore } from '../../store/locationStore';

type SplashNav = NativeStackNavigationProp<AuthStackParamList, 'Splash'>;

export default function SplashScreen() {
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
      <Animated.Text
        style={[styles.logo, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}
      >
        ⚡
      </Animated.Text>
      <Animated.Text style={[styles.name, { opacity: textOpacity }]}>Fuel on Go</Animated.Text>
      <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
        Book CNG. Skip the queue.
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
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
    color: colors.textPrimary,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontWeight: '500',
  },
});
