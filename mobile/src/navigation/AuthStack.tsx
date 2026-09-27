import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SplashScreen from '../screens/auth/SplashScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegistrationScreen from '../screens/auth/RegistrationScreen';
import LocationSetupScreen from '../screens/auth/LocationSetupScreen';

export type AuthStackParamList = {
  Splash: undefined;
  Login: undefined;
  Registration: undefined;
  LocationSetup: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0f0f0f' },
      }}
      initialRouteName="Splash"
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Registration" component={RegistrationScreen} options={{ headerShown: true, headerTitle: 'Create Profile', headerStyle: { backgroundColor: '#0f0f0f' }, headerTintColor: '#fff' }} />
      <Stack.Screen name="LocationSetup" component={LocationSetupScreen} options={{ headerShown: true, headerTitle: 'Set Location', headerStyle: { backgroundColor: '#0f0f0f' }, headerTintColor: '#fff' }} />
    </Stack.Navigator>
  );
}
