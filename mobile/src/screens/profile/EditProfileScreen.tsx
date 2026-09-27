import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, radius, spacing } from '../../theme/stitch';
import { useAuthStore } from '../../store/authStore';

export default function EditProfileScreen({ navigation }: any) {
  const { user, updateUser } = useAuthStore();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [vehicleNumber, setVehicleNumber] = useState(user?.vehicle_number ?? '');

  const onSave = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter your name.');
      return;
    }

    await updateUser({
      name: name.trim(),
      email: email.trim() || null,
      vehicle_number: vehicleNumber.trim().toUpperCase() || null,
    });

    Alert.alert('Saved', 'Profile updated successfully.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Edit Profile</Text>

        <Text style={styles.label}>Full Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email ?? ''}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={styles.label}>Vehicle Number</Text>
        <TextInput
          style={styles.input}
          value={vehicleNumber ?? ''}
          onChangeText={(v) => setVehicleNumber(v.toUpperCase())}
          autoCapitalize="characters"
        />

        <TouchableOpacity style={styles.button} onPress={onSave}>
          <Text style={styles.buttonText}>Save Changes</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    padding: spacing.md,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  label: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    color: colors.textPrimary,
  },
  button: {
    marginTop: 12,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    alignItems: 'center',
    paddingVertical: 12,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: fontSize.base,
  },
});
