import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import api from '../config/api';

interface ScanResult {
  success?: boolean;
  type?: 'already_scanned' | 'wrong_pump' | 'outside_window' | 'invalid';
  customer_name?: string;
  time?: string;
  pump?: string;
  slot?: string;
}

const QRScannerScreen = () => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);

    try {
      const response = await api.post('/bookings/checkin-by-admin', {
        qr_token: data,
      });
      setResult({ success: true, ...response.data });
    } catch (error: any) {
      const status = error.response?.status;
      if (status === 409) {
        setResult({ type: 'already_scanned', time: error.response.data.arrived_at });
      } else if (status === 403) {
        setResult({ type: 'wrong_pump', pump: error.response.data.pump_name });
      } else if (status === 400) {
        setResult({ type: 'outside_window', slot: error.response.data.slot_time });
      } else {
        setResult({ type: 'invalid' });
      }
    }
  };

  if (!permission) {
    return <Text>Requesting camera permission...</Text>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.resultText}>No access to camera</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />

      {result && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultText}>
            {result.success
              ? `Check-in successful for ${result.customer_name}`
              : result.type === 'already_scanned'
              ? `Already scanned at ${result.time}`
              : result.type === 'wrong_pump'
              ? `Wrong pump. Correct pump: ${result.pump}`
              : result.type === 'outside_window'
              ? `Outside booking window. Slot: ${result.slot}`
              : 'Invalid QR code'}
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              setScanned(false);
              setResult(null);
            }}
          >
            <Text style={styles.buttonText}>Scan Again</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultContainer: {
    position: 'absolute',
    bottom: 50,
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  resultText: {
    fontSize: 16,
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#00c896',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default QRScannerScreen;