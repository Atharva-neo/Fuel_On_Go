import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tabBarMetrics } from './tabBarMetrics';
import { slideScreenOptions, swipeLayout, useReduceMotion } from './swipeTabs';
import { useTheme } from '../theme';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import HomeScreen from '../screens/HomeScreen';
import PumpDetailScreen from '../screens/pump/PumpDetailScreen';
import PaymentScreen from '../screens/booking/PaymentScreen';
import MyBookingsScreen from '../screens/booking/MyBookingsScreen';
import BookingDetailScreen from '../screens/booking/BookingDetailScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

export type AppStackParamList = {
  HomeTabs: undefined;
  PumpDetail: { pumpId: string };
  Payment: any;
  BookingDetail: any;
  BookingSuccess: { booking: any };
  NavigationMap: { pump: any };
};

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<AppStackParamList>();

const HomeTabs = () => {
  const t = useTheme();
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
      tabBarLabelStyle: {
        fontWeight: '700',
        fontSize: 11,
        letterSpacing: 0.5,
      },
      tabBarIcon: ({ color, size }) => {
        let iconName: any;
        if (route.name === 'Home') iconName = 'gas-station';
        else if (route.name === 'MyBookings') iconName = 'text-box-check';
        else if (route.name === 'Profile') iconName = 'account-circle';

        return <MaterialCommunityIcons name={iconName} size={28} color={color} />;
      },
    })}
  >
    <Tab.Screen name="Home" component={HomeScreen} />
    <Tab.Screen name="MyBookings" component={MyBookingsScreen} options={{ tabBarLabel: 'Bookings' }} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
  );
};

export default function AppStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeTabs" component={HomeTabs} />
      <Stack.Screen name="PumpDetail" component={PumpDetailScreen} />
      <Stack.Screen name="Payment" component={PaymentScreen} />
      <Stack.Screen name="BookingDetail" component={BookingDetailScreen} />
    </Stack.Navigator>
  );
}
