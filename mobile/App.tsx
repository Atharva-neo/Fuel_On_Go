import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 },
  },
});

function AppContent() {
  const [ready, setReady] = useState(false);
  const [navError, setNavError] = useState<string | null>(null);
  const [RootNav, setRootNav] = useState<React.ComponentType | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const Nav = require('./src/navigation/RootNavigator').default;
        setRootNav(() => Nav);
        setReady(true);
      } catch (e: any) {
        setNavError(e?.message || 'Unknown startup error');
        setReady(true);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  if (!ready) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>⚡ Fuel on Go</Text>
        <Text style={styles.subtitle}>Starting up...</Text>
      </View>
    );
  }

  if (navError || !RootNav) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>⚡ Fuel on Go</Text>
        <Text style={styles.errorText}>
          {navError || 'Failed to load navigator'}
        </Text>
        <Text style={styles.subtitle}>
          Please restart the app
        </Text>
      </View>
    );
  }

  return <RootNav />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" backgroundColor="#0A0E1A" />
        <AppContent />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: '#0A0E1A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    color: '#00C896',
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 12,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    marginTop: 8,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
  },
});
