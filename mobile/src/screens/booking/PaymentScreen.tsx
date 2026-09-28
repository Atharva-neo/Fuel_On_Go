import React, { useState } from 'react';
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
import { ArrowLeftIcon } from '../../components/ui/Icons';

const BOOKING_FEE = 50; // Fixed ₹50 booking fee

export default function PaymentScreen({ route, navigation }: any) {
  const { pump, slot } = route.params || {};
  const [paymentType, setPaymentType] = useState<'partial' | 'full'>('partial');
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

  const cngPrice = Number(pump?.cng_price_per_kg || 89.5);
  const fullAmount = Number((8 * cngPrice).toFixed(2)); // estimate for display
  const paidNow = paymentType === 'partial' ? BOOKING_FEE : fullAmount;
  const remainingAtPump = paymentType === 'partial' ? fullAmount - BOOKING_FEE : 0;

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
        total_estimated: fullAmount,
        amount_paid_now: paidNow,
        pending_amount: remainingAtPump,
        fuel_payment_method: 'cash',
        payment_option: paymentType,
      });

      navigation.navigate('BookingSuccess', {
        booking: {
          ...booking,
          pump_name: pump.name,
          pump_address: pump.address,
          slot_date: slotDate,
          slot_start: slotStart,
          slot_end: slotEnd,
          amount_paid_now: paidNow,
          pending_amount: remainingAtPump,
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
          <ArrowLeftIcon size={24} color="#0A0A0A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Complete Booking</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Pump + Slot Card */}
        <View style={styles.card}>
          <Text style={styles.pumpName}>{pump.name}</Text>
          <Text style={styles.pumpAddress}>{pump.address}</Text>
          <View style={styles.divider} />
          <Text style={styles.slotTime}>
            📅 {slotDate}  ·  🕒 {slotStart} – {slotEnd}
          </Text>
        </View>

        {/* Payment Options */}
        <Text style={styles.sectionTitle}>Select Payment Option</Text>

        <TouchableOpacity
          style={[styles.optionCard, paymentType === 'partial' && styles.optionSelected]}
          onPress={() => setPaymentType('partial')}
          activeOpacity={0.8}
        >
          <View style={styles.optionLeft}>
            <View style={[styles.radio, paymentType === 'partial' && styles.radioSelected]}>
              {paymentType === 'partial' && <View style={styles.radioDot} />}
            </View>
            <View>
              <Text style={styles.optionTitle}>Pay ₹{BOOKING_FEE} Now</Text>
              <Text style={styles.optionSub}>Remaining ₹{remainingAtPump.toFixed(0)} to be paid at pump</Text>
            </View>
          </View>
          {paymentType === 'partial' && (
            <View style={styles.recommendedBadge}>
              <Text style={styles.recommendedText}>Recommended</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.optionCard, paymentType === 'full' && styles.optionSelected]}
          onPress={() => setPaymentType('full')}
          activeOpacity={0.8}
        >
          <View style={styles.optionLeft}>
            <View style={[styles.radio, paymentType === 'full' && styles.radioSelected]}>
              {paymentType === 'full' && <View style={styles.radioDot} />}
            </View>
            <View>
              <Text style={styles.optionTitle}>Pay Full Amount ₹{fullAmount.toFixed(2)}</Text>
              <Text style={styles.optionSub}>Nothing extra at pump</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Bill Summary */}
        <Text style={styles.sectionTitle}>Bill Summary</Text>
        <View style={styles.billCard}>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Estimated CNG cost</Text>
            <Text style={styles.billValue}>₹{fullAmount.toFixed(2)}</Text>
          </View>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Booking fee (secured)</Text>
            <Text style={styles.billValue}>₹{BOOKING_FEE.toFixed(2)}</Text>
          </View>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Pay at pump</Text>
            <Text style={styles.billValue}>₹{remainingAtPump.toFixed(2)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.billRow}>
            <Text style={styles.billTotal}>Pay Now</Text>
            <Text style={styles.billTotalValue}>₹{paidNow.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.simulationNote}>
          <Text style={styles.simulationNoteText}>
            ⚡ Payment simulation enabled — no real charge will occur.
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
              <ActivityIndicator color="#FFFFFF" size="small" />
              <Text style={styles.payText}>Processing...</Text>
            </View>
          ) : (
            <Text style={styles.payText}>
              Simulate Payment · ₹{paidNow.toFixed(2)}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { color: '#EF4444', fontSize: 16, textAlign: 'center', marginBottom: 20 },
  backBtnFull: {
    backgroundColor: '#0A0A0A', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12,
  },
  backBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  header: {
    paddingTop: 60, paddingHorizontal: 24, paddingBottom: 20,
    backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  backBtn: { padding: 8, marginLeft: -8 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#0A0A0A', letterSpacing: -0.5 },
  content: { padding: 24, paddingBottom: 40 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, marginBottom: 32,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  pumpName: { fontSize: 20, fontWeight: '900', color: '#0A0A0A', marginBottom: 4, letterSpacing: -0.5 },
  pumpAddress: { fontSize: 14, color: '#71717A', marginBottom: 12 },
  divider: { height: 1, backgroundColor: 'rgba(0,0,0,0.05)', marginVertical: 12 },
  slotTime: { fontSize: 15, color: '#00C896', fontWeight: '700' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0A0A0A', marginBottom: 12, letterSpacing: -0.3 },
  optionCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 2, borderColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  optionSelected: { borderColor: '#00C896' },
  optionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#D1D5DB',
    alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: '#00C896' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#00C896' },
  optionTitle: { fontSize: 15, fontWeight: '800', color: '#0A0A0A', marginBottom: 2 },
  optionSub: { fontSize: 13, color: '#71717A' },
  recommendedBadge: {
    backgroundColor: 'rgba(0,200,150,0.1)', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, alignSelf: 'flex-start', marginTop: 8,
  },
  recommendedText: { fontSize: 11, color: '#00C896', fontWeight: '700' },
  billCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)',
  },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  billLabel: { color: '#71717A', fontSize: 14, fontWeight: '500' },
  billValue: { color: '#0A0A0A', fontSize: 14, fontWeight: '700' },
  billTotal: { color: '#0A0A0A', fontSize: 16, fontWeight: '800' },
  billTotalValue: { color: '#0A0A0A', fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  simulationNote: {
    backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)',
  },
  simulationNoteText: { color: '#92400E', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  footer: {
    backgroundColor: '#FFFFFF', padding: 24, paddingBottom: 40,
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)',
  },
  payBtn: {
    backgroundColor: '#0A0A0A', borderRadius: 16, alignItems: 'center', paddingVertical: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
  payBtnDisabled: { opacity: 0.7, shadowOpacity: 0, elevation: 0 },
  processingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  payText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
});
