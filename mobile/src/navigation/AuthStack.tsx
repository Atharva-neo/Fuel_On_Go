import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SplashScreen from '../screens/auth/SplashScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegistrationScreen from '../screens/auth/RegistrationScreen';
import LocationSetupScreen from '../screens/auth/LocationSetupScreen';
import { useTheme } from '../theme';

export type AuthStackParamList = {
  Splash: undefined;
  Login: undefined;
  Registration: undefined;
  LocationSetup: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthStack() {
  const t = useTheme();
  const header = { headerShown: true, headerStyle: { backgroundColor: t.colors.bg }, headerTintColor: t.colors.text };
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: t.colors.bg },
      }}
      initialRouteName="Splash"
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Registration" component={RegistrationScreen} options={{ ...header, headerTitle: 'Create Profile' }} />
      <Stack.Screen name="LocationSetup" component={LocationSetupScreen} options={{ ...header, headerTitle: 'Set Location' }} />
    </Stack.Navigator>
  );
}
