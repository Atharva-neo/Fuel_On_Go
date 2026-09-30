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
import { ArrowLeftIcon, CheckIcon, AlertIcon, XIcon } from '../../components/ui/Icons';

function formatSlotTime(raw: string | undefined) {
  if (!raw) return '-';
  // "HH:MM:SS - HH:MM:SS" -> "HH:MM - HH:MM"
  return raw.replace(/(\d{2}:\d{2}):\d{2}/g, '$1');
}

function formatTimestamp(raw: string | undefined) {
  if (!raw) return '-';
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return raw;
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

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
      else if (status === 400 && errData?.code === 'PENDING_APPROVAL') setResult({ type: 'pending_approval', data: errData });
      else if (status === 400 && errData?.code === 'NOT_ACTIVE') setResult({ type: 'not_active', data: errData });
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
            ) : result?.type === 'success' ? (
              <>
                <View style={styles.modalHeader}>
                  <CheckIcon size={24} color="#00C896" />
                  <Text style={styles.modalTitle}>Check-in Successful!</Text>
                </View>

                <View style={styles.modalBody}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Customer</Text>
                    <Text style={styles.infoValue}>{result.customer_name || '-'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Vehicle</Text>
                    <Text style={styles.infoValue}>{result.vehicle_number || '-'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Slot Time</Text>
                    <Text style={styles.infoValue}>{formatSlotTime(result.slot_time)}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Fuel payment</Text>
                    <Text style={styles.infoValue}>{result.fuel_payment_method === 'upi' ? 'UPI' : 'Cash'} at pump</Text>
                  </View>

                  <TouchableOpacity style={styles.cancelBtn} onPress={handleCloseModal}>
                    <Text style={styles.cancelBtnText}>Scan Next</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : result?.type === 'wrong_pump' ? (
              <>
                <View style={styles.modalHeader}>
                  <AlertIcon size={24} color="#F59E0B" />
                  <Text style={styles.modalTitle}>Wrong Pump</Text>
                </View>
                <View style={styles.modalBody}>
                  <Text style={styles.errorMessage}>
                    This customer's booking is for{' '}
                    {result.data?.pump_name ? <Text style={{ fontWeight: '800' }}>{result.data.pump_name}</Text> : 'another pump'}
                    , not this one. You can't check them in here.
                  </Text>
                  <TouchableOpacity style={styles.cancelBtn} onPress={handleCloseModal}>
                    <Text style={styles.cancelBtnText}>Scan Next</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : result?.type === 'already_scanned' ? (
              <>
                <View style={styles.modalHeader}>
                  <AlertIcon size={24} color="#F59E0B" />
                  <Text style={styles.modalTitle}>Already Checked In</Text>
                </View>
                <View style={styles.modalBody}>
                  <Text style={styles.errorMessage}>
                    This booking was already checked in at {formatTimestamp(result.data?.arrived_at)}.
                  </Text>
                  <TouchableOpacity style={styles.cancelBtn} onPress={handleCloseModal}>
                    <Text style={styles.cancelBtnText}>Scan Next</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : result?.type === 'pending_approval' ? (
              <>
                <View style={styles.modalHeader}>
                  <AlertIcon size={24} color="#F59E0B" />
                  <Text style={styles.modalTitle}>Not Yet Approved</Text>
                </View>
                <View style={styles.modalBody}>
                  <Text style={styles.errorMessage}>
                    This booking is still awaiting your approval. Confirm it on the Bookings tab first, then scan again.
                  </Text>
                  <TouchableOpacity style={styles.cancelBtn} onPress={handleCloseModal}>
                    <Text style={styles.cancelBtnText}>Scan Next</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : result?.type === 'not_active' ? (
              <>
                <View style={styles.modalHeader}>
                  <XIcon size={24} color="#EF4444" />
                  <Text style={styles.modalTitle}>Booking Not Active</Text>
                </View>
                <View style={styles.modalBody}>
                  <Text style={styles.errorMessage}>
                    {result.data?.error || "This booking can't be checked in."}
                  </Text>
                  <TouchableOpacity style={styles.cancelBtn} onPress={handleCloseModal}>
                    <Text style={styles.cancelBtnText}>Scan Next</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : result?.type === 'outside_window' ? (
              <>
                <View style={styles.modalHeader}>
                  <AlertIcon size={24} color="#F59E0B" />
                  <Text style={styles.modalTitle}>
                    {result.data?.code === 'TOO_EARLY' ? 'Too Early' : 'Slot Expired'}
                  </Text>
                </View>
                <View style={styles.modalBody}>
                  <Text style={styles.errorMessage}>
                    {result.data?.code === 'TOO_EARLY'
                      ? "This customer's slot hasn't started yet. Ask them to come back closer to their slot time."
                      : 'This slot has already ended, so check-in is no longer available for this booking.'}
                  </Text>
                  <TouchableOpacity style={styles.cancelBtn} onPress={handleCloseModal}>
                    <Text style={styles.cancelBtnText}>Scan Next</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : result ? (
              <>
                <View style={styles.modalHeader}>
                  <XIcon size={24} color="#EF4444" />
                  <Text style={styles.modalTitle}>Invalid QR Code</Text>
                </View>
                <View style={styles.modalBody}>
                  <Text style={styles.errorMessage}>
                    {result.data?.error || "This QR code doesn't match a valid booking."}
                  </Text>
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
  errorMessage: {
    color: '#3F3F46',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
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
