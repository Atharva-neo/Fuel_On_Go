import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize } from '../theme/stitch';

export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>?</Text>
      <Text style={styles.title}>Fuel on Go</Text>
      <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A', // Dark background for splash
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    fontSize: 72,
    color: '#1a73e8',
  },
  title: {
    marginTop: 8,
    fontSize: 32,
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
