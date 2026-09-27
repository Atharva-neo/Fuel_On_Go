import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const AdminDashboardScreen = ({ navigation }: { navigation: any }) => {
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#00c896',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginVertical: 10,
    width: '80%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default AdminDashboardScreen;