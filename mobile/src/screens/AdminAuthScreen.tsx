import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/authStore';

function sanitizePhone(v: string) {
  return v.replace(/\D/g, '').slice(0, 10);
}

export default function AdminAuthScreen({ navigation }: any) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const setPendingAuth = useAuthStore((s) => s.setPendingAuth);

  const fullPhone = useMemo(() => authService.normalizePhone(phone), [phone]);

  const handleContinue = async () => {
    if (phone.length !== 10) {
      Alert.alert('Invalid phone', 'Please enter a valid 10-digit number.');
      return;
    }

    setLoading(true);
    try {
      const info = await authService.checkPhone(fullPhone);

      if (info.exists && info.has_name && (info.role === 'pump_owner' || info.role === 'admin')) {
        await authService.sendOtp(fullPhone);
        await setPendingAuth({ phone: fullPhone, flow: 'pump_owner', name: info.name ?? null, isNew: false });
        navigation.navigate('OTPVerify', {
          phone: fullPhone,
          flow: 'pump_owner',
          name: info.name ?? undefined,
        });
        return;
      }

      if (info.exists && info.role === 'user') {
        Alert.alert('Not a pump owner', 'This number is registered as a vehicle owner. Please register as pump owner.');
      }

      await setPendingAuth({ phone: fullPhone, flow: 'pump_owner', name: null, isNew: true });
      navigation.navigate('Registration', { phone: fullPhone, flow: 'pump_owner' });
    } catch (error: any) {
      console.log(
        "ADMIN LOGIN ERROR:",
        error?.response?.data || error?.message || error
      );

      Alert.alert(
        "Error",
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        JSON.stringify(error)
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pump Owner Login</Text>
      <Text style={styles.subtitle}>Continue as pump owner</Text>

      <View style={styles.phoneRow}>
        <Text style={styles.prefix}>+91</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={(v) => setPhone(sanitizePhone(v))}
          keyboardType="number-pad"
          placeholder="9876543210"
          placeholderTextColor="#A1A1AA"
          maxLength={10}
        />
      </View>

      <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleContinue} disabled={loading}>
        {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Continue as Pump Owner</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#0A0A0A',
    letterSpacing: -1,
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 32,
    color: '#71717A',
    fontSize: 16,
    letterSpacing: -0.2,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 16,
    height: 60,
  },
  prefix: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0A0A0A',
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 60,
    fontSize: 18,
    fontWeight: '600',
    color: '#0A0A0A',
    letterSpacing: 1,
  },
  button: {
    marginTop: 24,
    backgroundColor: '#111111',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
});

