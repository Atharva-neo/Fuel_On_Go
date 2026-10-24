import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fontSize, radius, spacing } from '../../theme/stitch';
import { useAuthStore } from '../../store/authStore';
import { useTheme, type Theme } from '../../theme';
import { useT } from '../../i18n';

export default function EditProfileScreen({ navigation }: any) {
  const t = useTheme();
  const { tr } = useT();
  const styles = useMemo(() => createStyles(t), [t]);
  const { user, updateUser } = useAuthStore();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [vehicleNumber, setVehicleNumber] = useState(user?.vehicle_number ?? '');

  const onSave = async () => {
    if (!name.trim()) {
      Alert.alert(tr('editProfile.nameRequired'), tr('editProfile.nameRequiredBody'));
      return;
    }

    await updateUser({
      name: name.trim(),
      email: email.trim() || null,
      vehicle_number: vehicleNumber.trim().toUpperCase() || null,
    });

    Alert.alert(tr('editProfile.saved'), tr('editProfile.savedBody'), [
      { text: tr('common.ok'), onPress: () => navigation.goBack() },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>{tr('editProfile.title')}</Text>

        <Text style={styles.label}>{tr('editProfile.fullName')}</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} />

        <Text style={styles.label}>{tr('editProfile.email')}</Text>
        <TextInput
          style={styles.input}
          value={email ?? ''}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={styles.label}>{tr('editProfile.vehicleNumber')}</Text>
        <TextInput
          style={styles.input}
          value={vehicleNumber ?? ''}
          onChangeText={(v) => setVehicleNumber(v.toUpperCase())}
          autoCapitalize="characters"
        />

        <TouchableOpacity style={styles.button} onPress={onSave}>
          <Text style={styles.buttonText}>{tr('common.save')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (t: Theme) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: t.colors.bg,
  },
  container: {
    padding: spacing.md,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    color: t.colors.text,
    marginBottom: spacing.md,
  },
  label: {
    color: t.colors.textSecondary,
    fontSize: fontSize.sm,
    marginBottom: 6,
  },
  input: {
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    color: t.colors.text,
  },
  button: {
    marginTop: 12,
    backgroundColor: t.colors.brand,
    borderRadius: radius.md,
    alignItems: 'center',
    paddingVertical: 12,
  },
  buttonText: {
    color: t.colors.onBrand,
    fontWeight: '700',
    fontSize: fontSize.base,
  },
});
