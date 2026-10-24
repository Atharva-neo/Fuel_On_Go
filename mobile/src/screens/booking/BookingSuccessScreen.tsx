import React, { useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { AppStackParamList } from '../../navigation/AppStack';
import { fontSize, radius, spacing } from '../../theme/stitch';
import type { MockBooking } from '../../mock/data';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { CheckIcon, CalendarIcon, AlertIcon } from '../../components/ui/Icons';
import { useTheme, type Theme } from '../../theme';
import { useT } from '../../i18n';


type SuccessNav = NativeStackNavigationProp<AppStackParamList, 'BookingSuccess'>;
type SuccessRoute = RouteProp<AppStackParamList, 'BookingSuccess'>;

export default function BookingSuccessScreen() {
  const t = useTheme();
  const { tr, fmt } = useT();
  const styles = useMemo(() => createStyles(t), [t]);
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
        <Animated.View style={[styles.check, styles.checkPending, { transform: [{ scale: checkScale }] }]}>
          <AlertIcon size={24} color={t.colors.onWarning} />
        </Animated.View>

        <Animated.View style={[styles.content, { opacity: contentOpacity }]}>
          <Text style={styles.title}>{tr('booking.requestSent')}</Text>
          <Text style={styles.subtitle}>{tr('booking.waitingConfirm')}</Text>

          {/* Summary */}
          <Card style={styles.summaryCard}>
            <Text style={styles.summaryPump}>{booking.pump_name}</Text>
            <View style={styles.summaryRow}>
              <CalendarIcon size={14} color={t.colors.textSecondary} />
              <Text style={styles.summarySlot}>
                {fmt.date(String(booking.slot_date))}, {fmt.clock(String(booking.slot_start))} – {fmt.clock(String(booking.slot_end))}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <MaterialCommunityIcons name="credit-card-outline" size={14} color={t.colors.brandText} />
              <Text style={styles.summaryPaid}>{tr('booking.paidLine', { amount: fmt.rupees(Number(booking.amount_paid_now || 0), 0) })}</Text>
            </View>
          </Card>

          {/* QR Code */}
          <View style={styles.qrContainer}>
            <View style={styles.qrBox}>
              <QRCode
                value={booking.qr_token}
                size={150}
                color={t.colors.qrForeground}
                backgroundColor={t.colors.qrBackground}
              />
            </View>
            <Text style={styles.qrLabel}>{tr('booking.showAtEntrance')}</Text>
            <Text style={styles.qrRef}>{tr('booking.ref', { ref: booking.id.slice(-8).toUpperCase() })}</Text>
          </View>

          {/* Buttons */}
          <View style={styles.buttonGroup}>
            <Button
              variant="outline"
              size="full"
              onPress={() => navigation.navigate('BookingDetail', { bookingId: booking.id })}
            >
              {tr('booking.viewBookingDetails')}
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
              {tr('booking.navigateToPump')}
            </Button>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (t: Theme) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.colors.bg },
  container: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  check: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: t.colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  checkPending: {
    backgroundColor: t.colors.warning,
  },
  content: { width: '100%', alignItems: 'center' },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    color: t.colors.text,
    textAlign: 'center',
    marginBottom: 2,
  },
  subtitle: { fontSize: fontSize.sm, color: t.colors.textSecondary, marginBottom: 12 },
  summaryCard: { width: '100%', gap: 4, marginBottom: 12, padding: 12 },
  summaryPump: { fontSize: fontSize.sm, fontWeight: '800', color: t.colors.text },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summarySlot: { fontSize: fontSize.xs, color: t.colors.textSecondary },
  summaryPaid: { fontSize: fontSize.xs, color: t.colors.brandText, fontWeight: '600' },
  qrBox: { backgroundColor: t.colors.qrBackground, padding: 10, borderRadius: 12 },
  qrContainer: {
    backgroundColor: t.colors.surface,
    borderRadius: radius.lg,
    padding: 12,
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
    shadowColor: t.colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  qrLabel: { fontSize: fontSize.xs, color: t.colors.textSecondary, fontWeight: '600' },
  qrRef: { fontSize: fontSize.xs, color: t.colors.textMuted },
  buttonGroup: { width: '100%' },
});
