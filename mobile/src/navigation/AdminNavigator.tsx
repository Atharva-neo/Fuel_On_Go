import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import QRScannerScreen from '../screens/admin/QRScannerScreen';
import AdminBookingsScreen from '../screens/admin/AdminBookingsScreen';
import SlotManagementScreen from '../screens/admin/SlotManagementScreen';
import AddPumpScreen from '../screens/admin/AddPumpScreen';
import AdminBookingDetailScreen from '../screens/admin/AdminBookingDetailScreen';
import CNGUpdateScreen from '../screens/admin/CNGUpdateScreen';
import OwnerFeedbackScreen from '../screens/admin/OwnerFeedbackScreen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tabBarMetrics } from './tabBarMetrics';
import { slideScreenOptions, swipeLayout, useReduceMotion } from './swipeTabs';
import { useTheme } from '../theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const AdminTabs = () => {
  const t = useTheme();
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  return (
  <Tab.Navigator
    screenLayout={swipeLayout()}
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
        if (route.name === 'AdminDashboard') iconName = 'view-dashboard';
        else if (route.name === 'ScanQR') iconName = 'qrcode-scan';
        else if (route.name === 'AdminBookings') iconName = 'text-box-multiple';
        else if (route.name === 'SlotManagement') iconName = 'calendar-clock';

        return <MaterialCommunityIcons name={iconName} size={26} color={color} />;
      },
    })}
  >
    <Tab.Screen
      name="AdminDashboard"
      component={AdminDashboardScreen}
      options={{ tabBarLabel: 'Dashboard' }}
    />
    <Tab.Screen
      name="ScanQR"
      component={QRScannerScreen}
      options={{ tabBarLabel: 'Scan QR' }}
    />
    <Tab.Screen
      name="AdminBookings"
      component={AdminBookingsScreen}
      options={{ tabBarLabel: 'Bookings' }}
    />
    <Tab.Screen
      name="SlotManagement"
      component={SlotManagementScreen}
      options={{ tabBarLabel: 'Slots' }}
    />
  </Tab.Navigator>
  );
};

export default function AdminNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminTabs" component={AdminTabs} />
      <Stack.Screen name="AddPump" component={AddPumpScreen} />
      <Stack.Screen name="AdminBookingDetail" component={AdminBookingDetailScreen} />
      <Stack.Screen name="CngUpdate" component={CNGUpdateScreen} />
      <Stack.Screen name="OwnerFeedback" component={OwnerFeedbackScreen} />
    </Stack.Navigator>
  );
}
