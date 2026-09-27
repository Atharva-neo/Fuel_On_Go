import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, radius, spacing } from '../../theme/stitch';
import { MOCK_BOOKINGS, MOCK_PUMPS, type MockBooking } from '../../mock/data';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Chip from '../../components/ui/Chip';

type FilterKey = 'all' | 'confirmed' | 'arrived' | 'no_show';

const BORDER: Record<string, string> = {
  confirmed: colors.secondary,
  arrived: colors.primary,
  no_show: colors.danger,
  cancelled: colors.border,
};

function BookingRow({ booking }: { booking: MockBooking }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <TouchableOpacity
      onPress={() => setExpanded((p) => !p)}
      style={[styles.row, { borderLeftColor: BORDER[booking.status] ?? colors.border }]}
    >
      <View style={styles.rowTop}>
        <Text style={styles.rowId}>#{booking.id.slice(-8).toUpperCase()}</Text>
        <Badge
          variant={
            booking.status === 'arrived' ? 'success'
            : booking.status === 'no_show' ? 'danger'
            : booking.status === 'confirmed' ? 'info'
            : 'neutral'
          }
          size="sm"
        >
          {booking.status.replace('_', ' ').toUpperCase()}
        </Badge>
      </View>
      <Text style={styles.rowUser}>👤 {booking.pump_name.split(' ')[0]} Customer · 🚗 MH09AB1234</Text>
      <Text style={styles.rowSlot}>🕐 {booking.slot_start} – {booking.slot_end}</Text>
      <Text style={styles.rowPayment}>
        💳 ₹{booking.amount_paid_now} paid
        {booking.pending_amount > 0 ? ` + ₹${booking.pending_amount} pending (${booking.fuel_payment_method})` : ' · Fully paid'}
      </Text>
      {expanded && (
        <View style={styles.expandedSection}>
          <Text style={styles.expandedLabel}>QR Token: {booking.qr_token}</Text>
          <TouchableOpacity style={styles.manualBtn}>
            <Text style={styles.manualBtnText}>✓ Manual Check-in</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function BookingHistoryScreen() {
  const [filter, setFilter] = useState<FilterKey>('all');
  const pump = MOCK_PUMPS[0];

  // Generate more mock bookings for demo
  const allBookings: MockBooking[] = [
    ...MOCK_BOOKINGS,
    {
      ...MOCK_BOOKINGS[0],
      id: 'booking-2',
      status: 'arrived',
      slot_start: '08:00',
      slot_end: '08:30',
    },
    {
      ...MOCK_BOOKINGS[0],
      id: 'booking-3',
      status: 'no_show',
      slot_start: '07:05',
      slot_end: '07:35',
      amount_paid_now: 30,
      pending_amount: 270,
    },
  ];

  const filtered =
    filter === 'all' ? allBookings : allBookings.filter((b) => b.status === filter);

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'arrived', label: 'Arrived' },
    { key: 'no_show', label: 'No-show' },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Booking History</Text>
        <Text style={styles.pumpName}>{pump.name}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        {FILTERS.map((f) => (
          <Chip
            key={f.key}
            label={f.label}
            selected={filter === f.key}
            onPress={() => setFilter(f.key)}
            style={{ marginRight: 8 }}
          />
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => <BookingRow booking={item} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No bookings for this filter</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { padding: spacing.md, paddingBottom: spacing.sm },
  title: { fontSize: fontSize.xxl, fontWeight: '800', color: colors.textPrimary },
  pumpName: { fontSize: fontSize.sm, color: colors.textSecondary },
  filterScroll: { paddingHorizontal: spacing.md, marginBottom: spacing.sm, maxHeight: 48, flexGrow: 0 },
  list: { padding: spacing.md, paddingBottom: 48, gap: 10 },
  row: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 5,
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowId: { fontSize: fontSize.sm, fontWeight: '800', color: colors.textPrimary, fontFamily: 'monospace' },
  rowUser: { fontSize: fontSize.sm, color: colors.textSecondary },
  rowSlot: { fontSize: fontSize.sm, color: colors.textSecondary },
  rowPayment: { fontSize: fontSize.xs, color: colors.textMuted },
  expandedSection: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8, paddingTop: 8, gap: 8 },
  expandedLabel: { fontSize: fontSize.xs, color: colors.textMuted, fontFamily: 'monospace' },
  manualBtn: {
    backgroundColor: colors.successBg, borderRadius: radius.md,
    padding: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.primary,
  },
  manualBtnText: { color: colors.primary, fontWeight: '700', fontSize: fontSize.sm },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { color: colors.textSecondary, fontSize: fontSize.base },
});
