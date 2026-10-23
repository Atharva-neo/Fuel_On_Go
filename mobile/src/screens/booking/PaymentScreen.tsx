import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { bookingService } from '../../services/booking.service';
import { ArrowLeftIcon, CalendarIcon, InfoIcon } from '../../components/ui/Icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme, type Theme } from '../../theme';

const BOOKING_FEE = 50; // Fixed ₹50 booking fee

export default function PaymentScreen({ route, navigation }: any) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const { pump, slot, fuel_payment_method } = route.params || {};
  const [processing, setProcessing] = useState(false);

  if (!pump || !slot) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Missing booking details. Please go back and try again.</Text>
        <TouchableOpacity style={styles.backBtnFull} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const paymentMethod: 'cash' | 'upi' = fuel_payment_method === 'upi' ? 'upi' : 'cash';

  const slotDate = slot?.slot_date || slot?.date || '';
  const slotStart = String(slot?.start_time || slot?.slot_start || '').slice(0, 5);
  const slotEnd = String(slot?.end_time || slot?.slot_end || '').slice(0, 5);

  const handlePay = async () => {
    setProcessing(true);
    try {
      // Simulate payment gateway delay
      await new Promise((r) => setTimeout(r, 1500));

      const booking = await bookingService.createBooking({
        pump_id: pump.id,
        slot_id: slot.id,
        slot_date: slotDate,
        slot_start: slotStart,
        slot_end: slotEnd,
        booking_fee: BOOKING_FEE,
        total_estimated: 0,
        amount_paid_now: BOOKING_FEE,
        pending_amount: 0,
        fuel_payment_method: paymentMethod,
        payment_option: 'partial',
      });

      navigation.navigate('BookingSuccess', {
        booking: {
          ...booking,
          pump_name: pump.name,
          pump_address: pump.address,
          slot_date: slotDate,
          slot_start: slotStart,
          slot_end: slotEnd,
          amount_paid_now: BOOKING_FEE,
          pending_amount: 0,
        },
      });
    } catch (error: any) {
      Alert.alert(
        'Payment Failed',
        error?.response?.data?.error || error?.message || 'Something went wrong. Please try again.'
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeftIcon size={24} color={t.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Complete Booking</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Pump + Slot Card */}
        <View style={styles.card}>
          <Text style={styles.pumpName}>{pump.name}</Text>
          <Text style={styles.pumpAddress}>{pump.address}</Text>
          <View style={styles.divider} />
          <View style={styles.slotTimeRow}>
            <CalendarIcon size={14} color={t.colors.brandText} />
            <Text style={styles.slotTime}>
              {slotDate}  ·  {slotStart} – {slotEnd}
            </Text>
          </View>
        </View>

        {/* Bill Summary */}
        <Text style={styles.sectionTitle}>Booking Fee</Text>
        <View style={styles.billCard}>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Slot booking fee</Text>
            <Text style={styles.billValue}>₹{BOOKING_FEE.toFixed(2)}</Text>
          </View>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>CNG fill amount</Text>
            <Text style={styles.billValue}>Pay at pump ({paymentMethod === 'upi' ? 'UPI' : 'Cash'})</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.billRow}>
            <Text style={styles.billTotal}>Pay Now</Text>
            <Text style={styles.billTotalValue}>₹{BOOKING_FEE.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.simulationNote}>
          <InfoIcon size={14} color={t.colors.warningText} />
          <Text style={styles.simulationNoteText}>
            Payment simulation enabled — no real charge will occur.
          </Text>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.payBtn, processing && styles.payBtnDisabled]}
          disabled={processing}
          onPress={handlePay}
        >
          {processing ? (
            <View style={styles.processingRow}>
              <ActivityIndicator color={t.colors.onInverse} size="small" />
              <Text style={styles.payText}>Processing...</Text>
            </View>
          ) : (
            <Text style={styles.payText}>
              Simulate Payment · ₹{BOOKING_FEE.toFixed(2)}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { color: t.colors.dangerText, fontSize: 16, textAlign: 'center', marginBottom: 20 },
  backBtnFull: {
    backgroundColor: t.colors.inverse, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12,
  },
  backBtnText: { color: t.colors.onInverse, fontWeight: '700', fontSize: 15 },
  header: {
    paddingTop: 60, paddingHorizontal: 24, paddingBottom: 20,
    backgroundColor: t.colors.surface, flexDirection: 'row', alignItems: 'center', gap: 16,
    borderBottomWidth: 1, borderBottomColor: t.colors.border,
  },
  backBtn: { padding: 8, marginLeft: -8 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: t.colors.text, letterSpacing: -0.5 },
  content: { padding: 24, paddingBottom: 40 },
  card: {
    backgroundColor: t.colors.surface, borderRadius: 16, padding: 20, marginBottom: 32,
    borderWidth: 1, borderColor: t.colors.border,
    shadowColor: t.colors.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  pumpName: { fontSize: 20, fontWeight: '900', color: t.colors.text, marginBottom: 4, letterSpacing: -0.5 },
  pumpAddress: { fontSize: 14, color: t.colors.textSecondary, marginBottom: 12 },
  divider: { height: 1, backgroundColor: t.colors.surfaceAlt, marginVertical: 12 },
  slotTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  slotTime: { fontSize: 15, color: t.colors.brandText, fontWeight: '700' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: t.colors.text, marginBottom: 12, letterSpacing: -0.3 },
  optionCard: {
    backgroundColor: t.colors.surface, borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 2, borderColor: t.colors.border,
    shadowColor: t.colors.shadow, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  optionSelected: { borderColor: t.colors.brand },
  optionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: t.colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: t.colors.brand },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: t.colors.brand },
  optionTitle: { fontSize: 15, fontWeight: '800', color: t.colors.text, marginBottom: 2 },
  optionSub: { fontSize: 13, color: t.colors.textSecondary },
  recommendedBadge: {
    backgroundColor: t.colors.brandTint, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, alignSelf: 'flex-start', marginTop: 8,
  },
  recommendedText: { fontSize: 11, color: t.colors.brandText, fontWeight: '700' },
  billCard: {
    backgroundColor: t.colors.surface, borderRadius: 16, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: t.colors.border,
  },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  billLabel: { color: t.colors.textSecondary, fontSize: 14, fontWeight: '500' },
  billValue: { color: t.colors.text, fontSize: 14, fontWeight: '700' },
  billTotal: { color: t.colors.text, fontSize: 16, fontWeight: '800' },
  billTotalValue: { color: t.colors.text, fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  simulationNote: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: t.colors.warningTint, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: t.colors.warning,
  },
  simulationNoteText: { flex: 1, color: t.colors.warningText, fontSize: 12, fontWeight: '600' },
  footer: {
    backgroundColor: t.colors.surface, padding: 24, paddingBottom: 40,
    borderTopWidth: 1, borderTopColor: t.colors.border,
  },
  payBtn: {
    backgroundColor: t.colors.inverse, borderRadius: 16, alignItems: 'center', paddingVertical: 18,
    shadowColor: t.colors.shadow, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
  payBtnDisabled: { opacity: 0.7, shadowOpacity: 0, elevation: 0 },
  processingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  payText: { color: t.colors.onInverse, fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
});
