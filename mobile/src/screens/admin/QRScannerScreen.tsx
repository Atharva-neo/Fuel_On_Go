import React, { useMemo, useState, useEffect } from 'react';
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
import { useIsFocused } from '@react-navigation/native';
import api from '../../config/api';
import { useAuthStore } from '../../store/authStore';
import { ArrowLeftIcon, CheckIcon, AlertIcon, XIcon } from '../../components/ui/Icons';
import { useTheme, type Theme } from '../../theme';
import { messageFromData } from '../../i18n/errors';
import { useT } from '../../i18n';


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
  const t = useTheme();
  const { tr, fmt } = useT();
  const styles = useMemo(() => createStyles(t), [t]);
  const [permission, requestPermission] = useCameraPermissions();
  const isFocused = useIsFocused(); // release the camera while another tab is showing
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
        <Text style={styles.permissionText}>{tr('qr.permission')}</Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>{tr('qr.grant')}</Text>
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
      {isFocused ? (
        <CameraView
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      <View style={styles.overlay}>
        <View style={styles.overlayTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeftIcon size={24} color={t.colors.onCamera} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{tr('qr.title')}</Text>
        </View>

        <View style={styles.overlayMiddle}>
          <View style={styles.scanArea}>
            <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanLineAnim }] }]} />
          </View>
        </View>

        <View style={styles.overlayBottom}>
          <Text style={styles.hintText}>{tr('qr.hint')}</Text>
        </View>
      </View>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {loading ? (
              <View style={styles.modalLoader}>
                <ActivityIndicator size="large" color={t.colors.brandText} />
                <Text style={styles.modalLoaderText}>{tr('qr.processing')}</Text>
              </View>
            ) : result?.type === 'success' ? (
              <>
                <View style={styles.modalHeader}>
                  <CheckIcon size={24} color={t.colors.brandText} />
                  <Text style={styles.modalTitle}>{tr('qr.success')}</Text>
                </View>

                <View style={styles.modalBody}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{tr('qr.customer')}</Text>
                    <Text style={styles.infoValue}>{result.customer_name || '-'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{tr('qr.vehicle')}</Text>
                    <Text style={styles.infoValue}>{result.vehicle_number || '-'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{tr('qr.slotTime')}</Text>
                    <Text style={styles.infoValue}>{String(result.slot_time || '').split(' - ').map((part: string) => fmt.clock(part)).join(' - ') || '-'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{tr('qr.fuelPayment')}</Text>
                    <Text style={styles.infoValue}>{tr('qr.atPump', { method: result.fuel_payment_method === 'upi' ? tr('payment.upi') : tr('payment.cash') })}</Text>
                  </View>

                  <TouchableOpacity style={styles.cancelBtn} onPress={handleCloseModal}>
                    <Text style={styles.cancelBtnText}>{tr('qr.scanNext')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : result?.type === 'wrong_pump' ? (
              <>
                <View style={styles.modalHeader}>
                  <AlertIcon size={24} color={t.colors.warningText} />
                  <Text style={styles.modalTitle}>{tr('qr.wrongPumpTitle')}</Text>
                </View>
                <View style={styles.modalBody}>
                  <Text style={styles.errorMessage}>
                    {tr('qr.wrongPump', { pump: result.data?.pump_name || tr('qr.anotherPump') })}
                  </Text>
                  <TouchableOpacity style={styles.cancelBtn} onPress={handleCloseModal}>
                    <Text style={styles.cancelBtnText}>{tr('qr.scanNext')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : result?.type === 'already_scanned' ? (
              <>
                <View style={styles.modalHeader}>
                  <AlertIcon size={24} color={t.colors.warningText} />
                  <Text style={styles.modalTitle}>{tr('qr.alreadyTitle')}</Text>
                </View>
                <View style={styles.modalBody}>
                  <Text style={styles.errorMessage}>
                    {tr('qr.alreadyBody', { time: result.data?.arrived_at ? fmt.time(result.data.arrived_at) : '-' })}
                  </Text>
                  <TouchableOpacity style={styles.cancelBtn} onPress={handleCloseModal}>
                    <Text style={styles.cancelBtnText}>{tr('qr.scanNext')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : result?.type === 'pending_approval' ? (
              <>
                <View style={styles.modalHeader}>
                  <AlertIcon size={24} color={t.colors.warningText} />
                  <Text style={styles.modalTitle}>{tr('qr.notApprovedTitle')}</Text>
                </View>
                <View style={styles.modalBody}>
                  <Text style={styles.errorMessage}>
                    {tr('qr.notApprovedBody')}
                  </Text>
                  <TouchableOpacity style={styles.cancelBtn} onPress={handleCloseModal}>
                    <Text style={styles.cancelBtnText}>{tr('qr.scanNext')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : result?.type === 'not_active' ? (
              <>
                <View style={styles.modalHeader}>
                  <XIcon size={24} color={t.colors.dangerText} />
                  <Text style={styles.modalTitle}>{tr('qr.notActiveTitle')}</Text>
                </View>
                <View style={styles.modalBody}>
                  <Text style={styles.errorMessage}>
                    {messageFromData(result.data, tr, 'qr.notActiveBody')}
                  </Text>
                  <TouchableOpacity style={styles.cancelBtn} onPress={handleCloseModal}>
                    <Text style={styles.cancelBtnText}>{tr('qr.scanNext')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : result?.type === 'outside_window' ? (
              <>
                <View style={styles.modalHeader}>
                  <AlertIcon size={24} color={t.colors.warningText} />
                  <Text style={styles.modalTitle}>
                    {result.data?.code === 'TOO_EARLY' ? tr('qr.tooEarly') : tr('qr.slotExpired')}
                  </Text>
                </View>
                <View style={styles.modalBody}>
                  <Text style={styles.errorMessage}>
                    {result.data?.code === 'TOO_EARLY'
                      ? tr('qr.tooEarlyBody')
                      : tr('qr.expiredBody')}
                  </Text>
                  <TouchableOpacity style={styles.cancelBtn} onPress={handleCloseModal}>
                    <Text style={styles.cancelBtnText}>{tr('qr.scanNext')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : result ? (
              <>
                <View style={styles.modalHeader}>
                  <XIcon size={24} color={t.colors.dangerText} />
                  <Text style={styles.modalTitle}>{tr('qr.invalidTitle')}</Text>
                </View>
                <View style={styles.modalBody}>
                  <Text style={styles.errorMessage}>
                    {messageFromData(result.data, tr, 'qr.invalidBody')}
                  </Text>
                  <TouchableOpacity style={styles.cancelBtn} onPress={handleCloseModal}>
                    <Text style={styles.cancelBtnText}>{tr('qr.scanNext')}</Text>
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

const createStyles = (t: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.colors.bg,
  },
  containerCenter: {
    flex: 1,
    backgroundColor: t.colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionText: {
    color: t.colors.text,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  permissionBtn: {
    backgroundColor: t.colors.brand,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  permissionBtnText: {
    color: t.colors.onBrand,
    fontWeight: '800',
    fontSize: 16,
  },
  overlay: {
    flex: 1,
  },
  overlayTop: {
    backgroundColor: t.colors.cameraScrim,
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
    backgroundColor: t.colors.cameraControl,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -8,
  },
  headerTitle: {
    color: t.colors.onCamera,
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
    borderColor: t.colors.brand,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    shadowColor: t.colors.brand,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  scanLine: {
    width: '100%',
    height: 2,
    backgroundColor: t.colors.brand,
    shadowColor: t.colors.brand,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 5,
  },
  overlayBottom: {
    backgroundColor: t.colors.cameraScrim,
    padding: 40,
    alignItems: 'center',
  },
  hintText: {
    color: t.colors.onCamera,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: t.colors.scrim,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: t.colors.surface,
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
    color: t.colors.text,
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
    borderBottomColor: t.colors.border,
  },
  modalTitle: {
    color: t.colors.text,
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
    backgroundColor: t.colors.surfaceAlt,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  infoLabel: {
    color: t.colors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  infoValue: {
    color: t.colors.text,
    fontWeight: '800',
    fontSize: 15,
  },
  errorMessage: {
    color: t.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  confirmBtn: {
    backgroundColor: t.colors.inverse,
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 18,
    marginTop: 8,
    shadowColor: t.colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmBtnText: {
    color: t.colors.onInverse,
    fontWeight: '800',
    fontSize: 16,
  },
  cancelBtn: {
    backgroundColor: t.colors.surfaceAlt,
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 18,
  },
  cancelBtnText: {
    color: t.colors.text,
    fontWeight: '700',
    fontSize: 16,
  },
});
