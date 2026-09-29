import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { AppStackParamList } from '../../navigation/AppStack';
import { colors, fontSize, radius, spacing } from '../../theme/stitch';
import type { MockBooking } from '../../mock/data';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { CheckIcon, CalendarIcon } from '../../components/ui/Icons';

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
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Checkmark */}
        <Animated.View style={[styles.check, { transform: [{ scale: checkScale }] }]}>
          <CheckIcon size={26} color={colors.white} />
        </Animated.View>

        <Animated.View style={[styles.content, { opacity: contentOpacity }]}>
          <Text style={styles.title}>Booking Confirmed!</Text>
          <Text style={styles.subtitle}>Your slot is reserved</Text>

          {/* Summary */}
          <Card style={styles.summaryCard}>
            <Text style={styles.summaryPump}>{booking.pump_name}</Text>
            <View style={styles.summaryRow}>
              <CalendarIcon size={14} color={colors.textSecondary} />
              <Text style={styles.summarySlot}>
                {booking.slot_date}, {booking.slot_start} – {booking.slot_end}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <MaterialCommunityIcons name="credit-card-outline" size={14} color={colors.primary} />
              <Text style={styles.summaryPaid}>Paid: ₹{booking.amount_paid_now}</Text>
            </View>
          </Card>

          {/* QR Code */}
          <View style={styles.qrContainer}>
            <QRCode
              value={booking.qr_token}
              size={150}
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
              onPress={() => navigation.navigate('BookingDetail', { bookingId: booking.id })}
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  check: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  content: { width: '100%', alignItems: 'center' },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 2,
  },
  subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: 12 },
  summaryCard: { width: '100%', gap: 4, marginBottom: 12, padding: 12 },
  summaryPump: { fontSize: fontSize.sm, fontWeight: '800', color: colors.textPrimary },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summarySlot: { fontSize: fontSize.xs, color: colors.textSecondary },
  summaryPaid: { fontSize: fontSize.xs, color: colors.primary, fontWeight: '600' },
  qrContainer: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 12,
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  qrLabel: { fontSize: fontSize.xs, color: '#555', fontWeight: '600' },
  qrRef: { fontSize: fontSize.xs, color: '#999' },
  buttonGroup: { width: '100%' },
});
