import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { AppStackParamList } from '../../navigation/AppStack';
import { colors, fontSize, radius, spacing } from '../../theme/stitch';
import type { MockBooking } from '../../mock/data';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';

type SuccessNav = NativeStackNavigationProp<AppStackParamList, 'BookingSuccess'>;
type SuccessRoute = RouteProp<AppStackParamList, 'BookingSuccess'>;

export default function BookingSuccessScreen() {
  const navigation = useNavigation<SuccessNav>();
  const route = useRoute<SuccessRoute>();
  const { booking } = route.params as { booking: MockBooking };

  const checkScale = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(checkScale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 10,
        stiffness: 100,
      }),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Checkmark */}
        <Animated.Text style={[styles.check, { transform: [{ scale: checkScale }] }]}>
          ✅
        </Animated.Text>

        <Animated.View style={[styles.content, { opacity: contentOpacity }]}>
          <Text style={styles.title}>Booking Confirmed! 🎉</Text>
          <Text style={styles.subtitle}>Your slot is reserved</Text>

          {/* Summary */}
          <Card style={styles.summaryCard}>
            <Text style={styles.summaryPump}>{booking.pump_name}</Text>
            <Text style={styles.summarySlot}>
              📅 {booking.slot_date}, {booking.slot_start} – {booking.slot_end}
            </Text>
            <Text style={styles.summaryPaid}>💳 Paid: ₹{booking.amount_paid_now}</Text>
          </Card>

          {/* QR Code */}
          <View style={styles.qrContainer}>
            <QRCode
              value={booking.qr_token}
              size={220}
              color="#000"
              backgroundColor="#fff"
            />
            <Text style={styles.qrLabel}>Show at pump entrance</Text>
            <Text style={styles.qrRef}>Ref: #{booking.id.slice(-8).toUpperCase()}</Text>
          </View>

          {/* Buttons */}
          <View style={styles.buttonGroup}>
            <Button
              variant="outline"
              size="full"
              onPress={() => navigation.navigate('BookingDetail', { booking })}
            >
              View Booking Details
            </Button>
            <View style={{ height: 8 }} />
            <Button
              variant="primary"
              size="full"
              rightIcon="→"
              onPress={() => navigation.navigate('NavigationMap', { pump: {
                id: booking.id,
                name: booking.pump_name,
                address: booking.pump_address,
                lat: booking.pump_lat,
                lng: booking.pump_lng,
              } as any })}
            >
              Navigate to Pump
            </Button>
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  check: { fontSize: 80, marginBottom: 16 },
  content: { width: '100%', alignItems: 'center' },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: { fontSize: fontSize.base, color: colors.textSecondary, marginBottom: 20 },
  summaryCard: { width: '100%', gap: 6, marginBottom: 20 },
  summaryPump: { fontSize: fontSize.base, fontWeight: '800', color: colors.textPrimary },
  summarySlot: { fontSize: fontSize.sm, color: colors.textSecondary },
  summaryPaid: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' },
  qrContainer: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 20,
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  qrLabel: { fontSize: fontSize.sm, color: '#555', fontWeight: '600' },
  qrRef: { fontSize: fontSize.xs, color: '#999' },
  buttonGroup: { width: '100%' },
});
