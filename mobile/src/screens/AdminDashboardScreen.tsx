import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme, type Theme } from '../theme';

const AdminDashboardScreen = ({ navigation }: { navigation: any }) => {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const handleNavigation = (screen: string) => {
    navigation.navigate(screen);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Admin Dashboard</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => handleNavigation('ScanQR')}
      >
        <Text style={styles.buttonText}>📷 Scan QR</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => handleNavigation('AdminBookings')}
      >
        <Text style={styles.buttonText}>📋 View Bookings</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => handleNavigation('SlotManagement')}
      >
        <Text style={styles.buttonText}>⚙️ Manage Slots</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => handleNavigation('AddPump')}
      >
        <Text style={styles.buttonText}>➕ Add Pump</Text>
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (t: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: t.colors.surfaceAlt,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: t.colors.text,
    marginBottom: 20,
  },
  button: {
    backgroundColor: t.colors.brand,
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginVertical: 10,
    width: '80%',
    alignItems: 'center',
  },
  buttonText: {
    color: t.colors.onBrand,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default AdminDashboardScreen;