import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import SplashScreen from '../screens/SplashScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import UserAuthScreen from '../screens/UserAuthScreen';
import AdminAuthScreen from '../screens/AdminAuthScreen';
import OTPScreen from '../screens/OTPScreen';
import RegistrationScreen from '../screens/RegistrationScreen';

import HomeScreen from '../screens/home/HomeScreen';
import PumpDetailScreen from '../screens/pump/PumpDetailScreen';
import BookingDetailScreen from '../screens/booking/BookingDetailScreen';
import BookingSuccessScreen from '../screens/booking/BookingSuccessScreen';
import MyBookingsScreen from '../screens/booking/MyBookingsScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import NavigationMapScreen from '../screens/booking/NavigationMapScreen';
import PaymentScreen from '../screens/booking/PaymentScreen';
import LocationSetupScreen from '../screens/auth/LocationSetupScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';
import PumpReviewsScreen from '../screens/pump/PumpReviewsScreen';

import AdminNavigator from './AdminNavigator';
import { useAuthStore } from '../store/authStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tabBarMetrics } from './tabBarMetrics';
import { slideScreenOptions, swipeLayout, useReduceMotion } from './swipeTabs';
import { useTheme, type Theme } from '../theme';
import { useT } from '../i18n';

export type RootStackParamList = {
  Welcome: undefined;
  UserAuth: undefined;
  AdminAuth: undefined;
  OTPVerify: { phone: string; flow: 'user' | 'pump_owner'; name?: string };
  Registration: { phone: string; flow: 'user' | 'pump_owner' };
};

export type HomeStackParamList = {
  HomeMain: undefined;
  PumpDetail: { pumpId: string };
  BookingDetail: { bookingId: string };
  Navigation: { lat: number; lng: number; pumpName?: string; address?: string };
  Payment: {
    pumpId: string;
    pumpName: string;
    slotId: string;
    slotStart: string;
    slotEnd: string;
    slotDate: string;
    pricePerKg: number;
    pumpAddress?: string;
    pumpLat: number;
    pumpLng: number;
  };
};

export type UserTabParamList = {
  Home: undefined;
  MyBookings: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const Tab = createBottomTabNavigator<UserTabParamList>();
const UserRootStack = createNativeStackNavigator();

const HomeStackNavigator = () => (
  <HomeStack.Navigator screenOptions={{ headerShown: false }}>
    <HomeStack.Screen name="HomeMain" component={HomeScreen} />
  </HomeStack.Navigator>
);

const UserTabs = () => {
  const t = useTheme();
  const { tr } = useT();
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  return (
  <Tab.Navigator
    screenLayout={swipeLayout(['Home'])}
    screenOptions={({ route }) => ({
      headerShown: false,
      ...slideScreenOptions(reduceMotion),
      tabBarStyle: {
        backgroundColor: t.colors.surface,
        borderTopWidth: 1,
        borderTopColor: t.colors.border,
        elevation: 10,
        ...tabBarMetrics(insets.bottom),
      },
      tabBarActiveTintColor: t.colors.brandText,
      tabBarInactiveTintColor: t.colors.textMuted,
      tabBarLabelStyle: { fontWeight: '700', fontSize: 11, letterSpacing: 0.3 },
      tabBarIcon: ({ color, size }) => {
        let iconName: any;
        if (route.name === 'Home') iconName = 'home-variant';
        else if (route.name === 'MyBookings') iconName = 'text-box-multiple';
        else if (route.name === 'Profile') iconName = 'account-circle';
        return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
      },
    })}
  >
    <Tab.Screen
      name="Home"
      component={HomeStackNavigator}
      options={{ tabBarLabel: tr('nav.home'), tabBarAccessibilityLabel: tr('nav.home') }}
    />
    <Tab.Screen
      name="MyBookings"
      component={MyBookingsScreen}
      options={{ tabBarLabel: tr('nav.bookings'), tabBarAccessibilityLabel: tr('nav.bookings') }}
    />
    <Tab.Screen
      name="Profile"
      component={ProfileScreen}
      options={{ tabBarLabel: tr('nav.profile'), tabBarAccessibilityLabel: tr('nav.profile') }}
    />
  </Tab.Navigator>
  );
};

const UserNavigator = () => (
  <UserRootStack.Navigator screenOptions={{ headerShown: false }}>
    <UserRootStack.Screen name="UserTabs" component={UserTabs} />
    <UserRootStack.Screen name="PumpDetail" component={PumpDetailScreen} />
    <UserRootStack.Screen name="PumpReviews" component={PumpReviewsScreen} />
    <UserRootStack.Screen name="BookingDetail" component={BookingDetailScreen} />
    <UserRootStack.Screen name="BookingSuccess" component={BookingSuccessScreen} />
    <UserRootStack.Screen name="Navigation" component={NavigationMapScreen} />
    <UserRootStack.Screen name="NavigationMap" component={NavigationMapScreen} />
    <UserRootStack.Screen name="Payment" component={PaymentScreen} />
    <UserRootStack.Screen name="LocationSetup" component={LocationSetupScreen} />
    <UserRootStack.Screen name="EditProfile" component={EditProfileScreen} />
  </UserRootStack.Navigator>
);

const RootGate = () => {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const { token, user, loading, rehydrateAuth } = useAuthStore();
  const [bootLoading, setBootLoading] = useState(true);
  const { tr } = useT();
  const [status, setStatus] = useState<'init' | 'checking' | 'ready' | 'error'>('init');

  useEffect(() => {
    setStatus('checking');

    const timeout = setTimeout(() => {
      setBootLoading(false);
    }, 6000);

    rehydrateAuth()
      .then(() => {
        setStatus('ready');
      })
      .catch(() => {
        setStatus('error');
      })
      .finally(() => {
        clearTimeout(timeout);
        setBootLoading(false);
      });

    return () => clearTimeout(timeout);
  }, [rehydrateAuth]);

  if (bootLoading || loading) {
    return (
      <View style={styles.loaderWrap}>
        <SplashScreen />
        <ActivityIndicator size="small" color={t.colors.brandText} style={styles.spinner} />
        <Text style={styles.status}>{tr(`boot.${status}`)}</Text>
      </View>
    );
  }

  if (!token) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="UserAuth" component={UserAuthScreen} />
        <Stack.Screen name="AdminAuth" component={AdminAuthScreen} />
        <Stack.Screen name="OTPVerify" component={OTPScreen} />
        <Stack.Screen name="Registration" component={RegistrationScreen} />
      </Stack.Navigator>
    );
  }

  if (user?.role === 'pump_owner' || user?.role === 'admin') {
    return <AdminNavigator />;
  }

  return <UserNavigator />;
};

export default function RootNavigator() {
  const t = useTheme();
  // Navigation chrome (headers, cards, transitions) follows the same theme store.
  const navTheme = useMemo(
    () => ({
      ...(t.isDark ? DarkTheme : DefaultTheme),
      colors: {
        ...(t.isDark ? DarkTheme : DefaultTheme).colors,
        primary: t.colors.brandText,
        background: t.colors.bg,
        card: t.colors.surface,
        text: t.colors.text,
        border: t.colors.border,
        notification: t.colors.danger,
      },
    }),
    [t]
  );
  const onReady = useCallback(() => {
    console.log('[Navigation] Ready');
  }, []);

  return (
    <NavigationContainer theme={navTheme} onReady={onReady}>
      <RootGate />
    </NavigationContainer>
  );
}

const createStyles = (t: Theme) => StyleSheet.create({
  loaderWrap: {
    flex: 1,
    backgroundColor: t.colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinner: {
    marginTop: 8,
  },
  status: {
    color: t.colors.textMuted,
    marginTop: 12,
    fontSize: 12,
  },
});
