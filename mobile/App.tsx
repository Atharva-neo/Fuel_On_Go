import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 },
  },
});

// Catches JS errors thrown outside React's render cycle (event handlers,
// unhandled promise rejections) that ErrorBoundary can't see, and shows
// them instead of letting the app crash silently.
const g: any = global as any;
if (g.ErrorUtils && !g.__fuelOnGoErrorHandlerInstalled) {
  g.__fuelOnGoErrorHandlerInstalled = true;
  const defaultHandler = g.ErrorUtils.getGlobalHandler?.();
  g.ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    console.error('[GlobalError]', isFatal ? 'FATAL' : 'non-fatal', error);
    Alert.alert(
      isFatal ? 'Unexpected error' : 'Something went wrong',
      error?.message || String(error)
    );
    defaultHandler?.(error, isFatal);
  });
}

// Catches render-time errors anywhere in the navigation tree so a crash
// shows a readable message instead of silently killing the app.
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught render error:', error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <View style={styles.center}>
          <Text style={styles.title}>⚡ Fuel on Go</Text>
          <Text style={styles.errorText}>Something went wrong.</Text>
          <ScrollView style={{ maxHeight: 200, marginTop: 12 }}>
            <Text style={styles.errorDetail}>
              {this.state.error.message}
              {'\n'}
              {this.state.error.stack}
            </Text>
          </ScrollView>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => this.setState({ error: null })}
          >
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

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

  return (
    <ErrorBoundary>
      <RootNav />
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" backgroundColor="#0A0E1A" />
        <ErrorBoundary>
          <AppContent />
        </ErrorBoundary>
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
  errorDetail: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    paddingHorizontal: 20,
  },
  retryBtn: {
    marginTop: 20,
    backgroundColor: '#00C896',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryText: {
    color: '#0A0A0A',
    fontWeight: '800',
    fontSize: 14,
  },
});
