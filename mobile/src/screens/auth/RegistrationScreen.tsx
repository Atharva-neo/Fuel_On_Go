import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/AuthStack';
import { colors, fontSize, radius, spacing } from '../../theme/stitch';
import { useAuthStore } from '../../store/authStore';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Chip from '../../components/ui/Chip';

type RegNav = NativeStackNavigationProp<AuthStackParamList, 'Registration'>;

type VehicleType = 'Car' | 'Auto' | 'Bus' | 'Other';
const VEHICLE_OPTIONS: { label: string; value: VehicleType; icon: string }[] = [
  { label: 'Car', value: 'Car', icon: '🚗' },
  { label: 'Auto', value: 'Auto', icon: '🛺' },
  { label: 'Bus', value: 'Bus', icon: '🚌' },
  { label: 'Other', value: 'Other', icon: '🚛' },
];

export default function RegistrationScreen() {
  const navigation = useNavigation<RegNav>();
  const { register } = useAuthStore();

  const [name, setName] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('Car');
  const [nameError, setNameError] = useState('');
  const [vehicleError, setVehicleError] = useState('');
  const [loading, setLoading] = useState(false);

  const validate = () => {
    let valid = true;
    if (name.trim().length < 2) {
      setNameError('Name must be at least 2 characters');
      valid = false;
    } else { setNameError(''); }
    if (vehicleNumber.trim().length < 4) {
      setVehicleError('Enter a valid vehicle number (e.g. MH12AB1234)');
      valid = false;
    } else { setVehicleError(''); }
    return valid;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await register({
        name: name.trim(),
        vehicle_number: vehicleNumber.trim().toUpperCase(),
        vehicle_type: vehicleType,
        role: 'user',
      });
      navigation.navigate('LocationSetup');
    } catch (err: any) {
      console.error('Registration error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Create Your Profile</Text>
            <Text style={styles.subtitle}>One-time setup to get started</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Input
              label="Full Name"
              placeholder="e.g. Prashant Patil"
              leftIcon="👤"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              error={nameError}
              returnKeyType="next"
            />

            <Input
              label="Vehicle Number"
              placeholder="e.g. MH12AB1234"
              leftIcon="🚗"
              value={vehicleNumber}
              onChangeText={(t) => setVehicleNumber(t.toUpperCase())}
              autoCapitalize="characters"
              error={vehicleError}
            />

            {/* Vehicle Type */}
            <Text style={styles.sectionLabel}>Vehicle Type</Text>
            <View style={styles.chipRow}>
              {VEHICLE_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  label={opt.label}
                  icon={opt.icon}
                  selected={vehicleType === opt.value}
                  onPress={() => setVehicleType(opt.value)}
                />
              ))}
            </View>

            <View style={styles.spacer} />
            <Button
              variant="primary"
              size="full"
              loading={loading}
              onPress={handleSubmit}
              rightIcon="→"
            >
              Get Started
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, padding: spacing.md, paddingTop: spacing.lg },
  header: { marginBottom: spacing.lg },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  subtitle: { fontSize: fontSize.base, color: colors.textSecondary },
  form: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: spacing.md,
  },
  spacer: { height: 8 },
});
