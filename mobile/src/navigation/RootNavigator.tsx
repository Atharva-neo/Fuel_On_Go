import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import SplashScreen from '../screens/SplashScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import UserAuthScreen from '../screens/UserAuthScreen';
import AdminAuthScreen from '../screens/AdminAuthScreen';
import OTPScreen from '../screens/OTPScreen';
import RegistrationScreen from '../screens/RegistrationScreen';

import HomeScreen from '../screens/home/HomeScreen';
import PumpDetailScreen from '../screens/pump/PumpDetailScreen';
import BookingDetailScreen from '../screens/booking/BookingDetailScreen';
import MyBookingsScreen from '../screens/booking/MyBookingsScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import NavigationMapScreen from '../screens/booking/NavigationMapScreen';
import PaymentScreen from '../screens/booking/PaymentScreen';
import LocationSetupScreen from '../screens/auth/LocationSetupScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';

import AdminNavigator from './AdminNavigator';
import { useAuthStore } from '../store/authStore';

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

const UserTabs = () => (
  <Tab.Navigator screenOptions={{ headerShown: false }}>
    <Tab.Screen
      name="Home"
      component={HomeStackNavigator}
      options={{ tabBarLabel: 'Home' }}
    />
    <Tab.Screen
      name="MyBookings"
      component={MyBookingsScreen}
      options={{ tabBarLabel: 'Bookings' }}
    />
    <Tab.Screen
      name="Profile"
      component={ProfileScreen}
      options={{ tabBarLabel: 'Profile' }}
    />
  </Tab.Navigator>
);

const UserNavigator = () => (
  <UserRootStack.Navigator screenOptions={{ headerShown: false }}>
    <UserRootStack.Screen name="UserTabs" component={UserTabs} />
    <UserRootStack.Screen name="PumpDetail" component={PumpDetailScreen} />
    <UserRootStack.Screen name="BookingDetail" component={BookingDetailScreen} />
    <UserRootStack.Screen name="Navigation" component={NavigationMapScreen} />
    <UserRootStack.Screen name="NavigationMap" component={NavigationMapScreen} />
    <UserRootStack.Screen name="Payment" component={PaymentScreen} />
    <UserRootStack.Screen name="LocationSetup" component={LocationSetupScreen} />
    <UserRootStack.Screen name="EditProfile" component={EditProfileScreen} />
  </UserRootStack.Navigator>
);

const RootGate = () => {
  const { token, user, loading, rehydrateAuth } = useAuthStore();
  const [bootLoading, setBootLoading] = useState(true);
  const [status, setStatus] = useState('Initializing...');

  useEffect(() => {
    setStatus('Checking session...');

    const timeout = setTimeout(() => {
      setBootLoading(false);
    }, 6000);

    rehydrateAuth()
      .then(() => {
        setStatus('Ready');
      })
      .catch(() => {
        setStatus('Error loading session');
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
        <ActivityIndicator size="small" color="#00C896" style={styles.spinner} />
        <Text style={styles.status}>{status}</Text>
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
  const onReady = useCallback(() => {
    console.log('[Navigation] Ready');
  }, []);

  return (
    <NavigationContainer onReady={onReady}>
      <RootGate />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loaderWrap: {
    flex: 1,
    backgroundColor: '#0A0E1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinner: {
    marginTop: 8,
  },
  status: {
    color: '#64748b',
    marginTop: 12,
    fontSize: 12,
  },
});
