import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/authStore';
import { CarIcon, AutoIcon, BusIcon, CheckIcon } from '../components/ui/Icons';
import { useTheme, type Theme } from '../theme';

const VEHICLE_TYPES: Array<{ type: 'Car' | 'Auto' | 'Bus' | 'Other', icon: React.FC<any> }> = [
  { type: 'Car', icon: CarIcon },
  { type: 'Auto', icon: AutoIcon },
  { type: 'Bus', icon: BusIcon },
  { type: 'Other', icon: CarIcon },
];

export default function RegistrationScreen({ route, navigation }: any) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const params = route.params || {};
  const flow: 'user' | 'pump_owner' = params.flow === 'pump_owner' ? 'pump_owner' : 'user';
  const phone: string = authService.normalizePhone(params.phone || '');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleType, setVehicleType] = useState<'Car' | 'Auto' | 'Bus' | 'Other'>('Car');
  const [businessName, setBusinessName] = useState('');
  const [loading, setLoading] = useState(false);

  const setPendingAuth = useAuthStore((s) => s.setPendingAuth);

  const title = useMemo(() => (flow === 'pump_owner' ? 'Register as Pump Owner' : 'Create Account'), [flow]);

  const onSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Missing field', 'Full name is required.');
      return;
    }

    if (flow === 'user') {
      if (!vehicleNumber.trim()) {
        Alert.alert('Missing field', 'Vehicle number is required.');
        return;
      }
    } else {
      if (!email.trim() || !businessName.trim()) {
        Alert.alert('Missing field', 'Email and business name are required for pump owner.');
        return;
      }
    }

    setLoading(true);
    try {
      if (flow === 'user') {
        await authService.registerUser({
          name: name.trim(),
          phone,
          email: email.trim() || undefined,
          vehicle_number: vehicleNumber.trim().toUpperCase(),
          vehicle_type: vehicleType,
        });
      } else {
        await authService.registerAdmin({
          name: name.trim(),
          phone,
          email: email.trim(),
          business_name: businessName.trim(),
        });
      }

      await setPendingAuth({ phone, flow, name: name.trim() });
      navigation.navigate('OTPVerify', { phone, flow, name: name.trim() });
    } catch (error: any) {
      console.log('REGISTRATION ERROR:', error?.response?.data || error?.message || error);
      Alert.alert(
        'Registration failed', 
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.progressRow}>
        <View style={styles.progressDotActive} />
        <View style={styles.progressDotInactive} />
      </View>
      <Text style={styles.title}>{title}</Text>

      <Text style={styles.label}>Full Name*</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Your full name"
        placeholderTextColor={t.colors.placeholder}
      />

      <Text style={styles.label}>Phone*</Text>
      <TextInput
        style={[styles.input, styles.disabled]}
        value={phone}
        editable={false}
      />

      {flow === 'user' ? (
        <>
          <Text style={styles.label}>Vehicle Number*</Text>
          <TextInput
            style={styles.input}
            value={vehicleNumber}
            onChangeText={(v) => setVehicleNumber(v.toUpperCase())}
            placeholder="MH12AB1234"
            placeholderTextColor={t.colors.placeholder}
            autoCapitalize="characters"
          />

          <Text style={styles.label}>Vehicle Type</Text>
          <View style={styles.chipRow}>
            {VEHICLE_TYPES.map(({ type, icon: Icon }) => {
              const isActive = vehicleType === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[styles.chip, isActive && styles.chipActive]}
                  onPress={() => setVehicleType(type)}
                >
                  <Icon size={18} color={isActive ? t.colors.text : t.colors.textSecondary} />
                  <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{type}</Text>
                  {isActive && <CheckIcon size={14} color={t.colors.text} />}
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Email (optional)</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="example@mail.com"
            placeholderTextColor={t.colors.placeholder}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </>
      ) : (
        <>
          <Text style={styles.label}>Email*</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="owner@business.com"
            placeholderTextColor={t.colors.placeholder}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Business Name*</Text>
          <TextInput
            style={styles.input}
            value={businessName}
            onChangeText={setBusinessName}
            placeholder="Your CNG station name"
            placeholderTextColor={t.colors.placeholder}
          />
        </>
      )}

      <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={onSubmit} disabled={loading}>
        {loading ? (
          <ActivityIndicator color={flow === 'pump_owner' ? t.colors.onBrand : t.colors.text} />
        ) : (
          <Text style={flow === 'pump_owner' ? styles.buttonTextAdmin : styles.buttonText}>
            {flow === 'pump_owner' ? 'Register & Get OTP' : 'Create Account & Get OTP'}
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const createStyles = (t: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.colors.bg,
  },
  content: {
    padding: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  progressDotActive: {
    width: 24,
    height: 6,
    backgroundColor: t.colors.inverse,
    borderRadius: 3,
  },
  progressDotInactive: {
    width: 24,
    height: 6,
    backgroundColor: t.colors.surfaceAlt,
    borderRadius: 3,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: t.colors.text,
    marginBottom: 32,
    letterSpacing: -1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: t.colors.textSecondary,
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  input: {
    backgroundColor: t.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 60,
    marginBottom: 20,
    fontSize: 16,
    color: t.colors.text,
    fontWeight: '500',
  },
  disabled: {
    backgroundColor: t.colors.surfaceAlt,
    color: t.colors.textMuted,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
    gap: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: t.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: t.colors.surfaceAlt,
    gap: 8,
  },
  chipActive: {
    backgroundColor: t.colors.brand,
    borderColor: t.colors.brand,
    shadowColor: t.colors.brand,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  chipText: {
    color: t.colors.textSecondary,
    fontWeight: '600',
    fontSize: 15,
  },
  chipTextActive: {
    color: t.colors.text,
    fontWeight: '700',
  },
  button: {
    marginTop: 24,
    backgroundColor: t.colors.brand,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: t.colors.brand,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: t.colors.onBrand,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  buttonTextAdmin: {
    color: t.colors.onBrand,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
});

