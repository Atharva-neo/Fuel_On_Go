import React, { useState, useEffect } from 'react';
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import api from '../../config/api';
import { useAuthStore } from '../../store/authStore';
import { ArrowLeftIcon, CheckIcon } from '../../components/ui/Icons';

const { width } = Dimensions.get('window');
const SCAN_AREA_SIZE = width * 0.7;

export default function QRScannerScreen({ navigation }: any) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const token = useAuthStore((s) => s.token);

  const scanLineAnim = new Animated.Value(0);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: SCAN_AREA_SIZE,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  if (!permission) return <View />;
  
  if (!permission.granted) {
    return (
      <View style={styles.containerCenter}>
        <Text style={styles.permissionText}>We need your permission to show the camera.</Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarCodeScanned = async ({ data }: any) => {
    if (scanned || loading) return;
    setScanned(true);
    setLoading(true);
    try {
      let qrToken: string;
      try {
        const parsed = JSON.parse(data);
        qrToken = parsed.qr_token;
      } catch {
        qrToken = data;
      }
      const response = await api.post('/bookings/checkin-by-admin', { qr_token: qrToken }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setResult({ type: 'success', ...response.data });
      setModalVisible(true);
    } catch (err: any) {
      const status = err?.response?.status;
      const errData = err?.response?.data;
      if (status === 409) setResult({ type: 'already_scanned', data: errData });
      else if (status === 403) setResult({ type: 'wrong_pump', data: errData });
      else if (status === 400) setResult({ type: 'outside_window', data: errData });
      else setResult({ type: 'invalid', data: errData });
      setModalVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setResult(null);
    setScanned(false);
  };

  return (
    <View style={styles.container}>
      <CameraView
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        style={StyleSheet.absoluteFill}
      />
      
      <View style={styles.overlay}>
        <View style={styles.overlayTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeftIcon size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan Customer QR</Text>
        </View>

        <View style={styles.overlayMiddle}>
          <View style={styles.scanArea}>
            <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanLineAnim }] }]} />
          </View>
        </View>

        <View style={styles.overlayBottom}>
          <Text style={styles.hintText}>Align QR code within the frame to scan.</Text>
        </View>
      </View>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {loading ? (
              <View style={styles.modalLoader}>
                <ActivityIndicator size="large" color="#00C896" />
                <Text style={styles.modalLoaderText}>Processing...</Text>
              </View>
            ) : result ? (
              <>
                <View style={styles.modalHeader}>
                  <CheckIcon size={24} color="#00C896" />
                  <Text style={styles.modalTitle}>{result.type === 'success' ? 'Check-in Successful!' : 'Scan Result'}</Text>
                </View>
                
                <View style={styles.modalBody}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Customer</Text>
                    <Text style={styles.infoValue}>{result.customer_name || result.data?.customer_name || '-'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Vehicle</Text>
                    <Text style={styles.infoValue}>{result.vehicle_number || result.data?.vehicle_number || '-'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Slot Time</Text>
                    <Text style={styles.infoValue}>{result.slot_time || result.data?.slot_time || '-'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Collect at pump</Text>
                    <Text style={styles.infoValue}>₹{Number(result.remaining_amount || result.data?.remaining_amount || 0).toFixed(2)}</Text>
                  </View>
                  
                  <TouchableOpacity style={styles.cancelBtn} onPress={handleCloseModal}>
                    <Text style={styles.cancelBtnText}>Scan Next</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  containerCenter: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  permissionBtn: {
    backgroundColor: '#00C896',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  permissionBtnText: {
    color: '#0A0A0A',
    fontWeight: '800',
    fontSize: 16,
  },
  overlay: {
    flex: 1,
  },
  overlayTop: {
    backgroundColor: 'rgba(10, 10, 10, 0.8)',
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -8,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  overlayMiddle: {
    flex: 1,
    flexDirection: 'row',
  },
  scanArea: {
    width: SCAN_AREA_SIZE,
    height: SCAN_AREA_SIZE,
    alignSelf: 'center',
    marginHorizontal: 'auto',
    borderWidth: 2,
    borderColor: '#00C896',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    shadowColor: '#00C896',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  scanLine: {
    width: '100%',
    height: 2,
    backgroundColor: '#00C896',
    shadowColor: '#00C896',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 5,
  },
  overlayBottom: {
    backgroundColor: 'rgba(10, 10, 10, 0.8)',
    padding: 40,
    alignItems: 'center',
  },
  hintText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalLoader: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 16,
  },
  modalLoaderText: {
    color: '#0A0A0A',
    fontWeight: '700',
    fontSize: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  modalTitle: {
    color: '#0A0A0A',
    fontWeight: '900',
    fontSize: 22,
    letterSpacing: -0.5,
  },
  modalBody: {
    gap: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  infoLabel: {
    color: '#71717A',
    fontWeight: '600',
    fontSize: 14,
  },
  infoValue: {
    color: '#0A0A0A',
    fontWeight: '800',
    fontSize: 15,
  },
  confirmBtn: {
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 18,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  cancelBtn: {
    backgroundColor: '#F4F4F5',
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 18,
  },
  cancelBtnText: {
    color: '#0A0A0A',
    fontWeight: '700',
    fontSize: 16,
  },
});
