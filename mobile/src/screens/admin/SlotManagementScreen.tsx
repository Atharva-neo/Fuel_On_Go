import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import api from '../../config/api';

const DATES = [
  { label: 'Today', value: 0 },
  { label: 'Tomorrow', value: 1 },
  { label: 'Day After', value: 2 },
];

function getDateString(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
}

function formatTime(isoString: string) {
  if (!isoString) return '';
  // Handle both "HH:MM:SS" time strings and full ISO timestamps
  let dateObj: Date;
  if (isoString.includes('T') || isoString.includes(' ')) {
    dateObj = new Date(isoString);
  } else {
    // Plain time "HH:MM:SS" — combine with today's date
    const today = new Date().toISOString().split('T')[0];
    dateObj = new Date(`${today}T${isoString}`);
  }
  return dateObj.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

const REASON_CHIPS = [
  '🛢️ CNG supply over',
  '🔧 Maintenance',
  '🚛 Truck delivery pending',
  '⚡ Technical issue',
  '🌧️ Weather conditions',
];

export default function SlotManagementScreen() {
  const [selectedDay, setSelectedDay] = useState(0);
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deactivateModal, setDeactivateModal] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [resumeTime, setResumeTime] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchSlots = async () => {
    setLoading(true);
    setError(null);
    try {
      const date = getDateString(selectedDay);
      const res = await api.get(`/admin/slots?date=${date}`);
      setSlots(res.data.slots || res.data || []);
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Failed to load slots';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSlots();
  }, [selectedDay]);

  const handleToggle = (slot: any) => {
    if (slot.status === 'open') {
      setReason('');
      setResumeTime('');
      setDeactivateModal(slot);
    } else if (slot.status === 'deactivated') {
      handleActivate(slot);
    }
  };

  const handleActivate = async (slot: any) => {
    try {
      await api.patch(`/slots/${slot.id}/activate`);
      fetchSlots();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to activate slot');
    }
  };

  const handleDeactivate = async () => {
    if (!reason.trim()) {
      Alert.alert('Required', 'Please provide a reason for deactivation');
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/slots/${deactivateModal.id}/deactivate`, {
        reason: reason.trim(),
        resume_time: resumeTime.trim() || null,
      });
      setDeactivateModal(null);
      fetchSlots();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to deactivate slot');
    } finally {
      setSaving(false);
    }
  };

  const handleCapacityChange = async (slot: any, delta: number) => {
    const newCap = (slot.capacity || 5) + delta;
    if (newCap < 1) return;
    const booked = slot.booked_count || 0;
    if (newCap < booked) {
      Alert.alert('Cannot reduce', `${booked} vehicles already booked for this slot`);
      return;
    }
    try {
      await api.patch(`/slots/${slot.id}/capacity`, { capacity: newCap });
      // Optimistic update
      setSlots((prev) =>
        prev.map((s) => (s.id === slot.id ? { ...s, capacity: newCap } : s))
      );
    } catch (err: any) {
      Alert.alert('Error', 'Failed to update capacity');
    }
  };

  const renderSlotRow = (slot: any) => {
    const isActive = slot.status === 'open';
    const booked = slot.booked_count || 0;
    const cap = slot.capacity || 5;
    const isFull = booked >= cap;

    return (
      <View
        key={slot.id}
        style={[styles.slotCard, !isActive && styles.slotCardInactive]}
      >
        {/* Time + Toggle */}
        <View style={styles.slotHeader}>
          <Text style={styles.slotTime}>
            {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
          </Text>
          <Switch
            value={isActive}
            onValueChange={() => handleToggle(slot)}
            trackColor={{ false: '#374151', true: '#00C896' }}
            thumbColor={isActive ? '#ffffff' : '#9CA3AF'}
            ios_backgroundColor="#374151"
          />
        </View>

        {/* Booking progress bar */}
        <View style={styles.progressRow}>
          <View style={styles.progressBg}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${cap > 0 ? Math.min((booked / cap) * 100, 100) : 0}%`,
                  backgroundColor: isFull ? '#EF4444' : booked > 0 ? '#F59E0B' : '#00C896',
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>{booked}/{cap} booked</Text>
        </View>

        {/* Capacity stepper */}
        <View style={styles.capacityRow}>
          <Text style={styles.capacityLabel}>Capacity:</Text>
          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() => handleCapacityChange(slot, -1)}
          >
            <Text style={styles.stepBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.capacityNum}>{cap}</Text>
          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() => handleCapacityChange(slot, +1)}
          >
            <Text style={styles.stepBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Deactivation reason banner */}
        {slot.status === 'deactivated' && slot.deactivation_reason ? (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonText}>⚠️ {slot.deactivation_reason}</Text>
            {slot.resume_time ? (
              <Text style={styles.resumeText}>Resumes: {slot.resume_time}</Text>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Slot Management</Text>
      </View>

      {/* Date tabs */}
      <View style={styles.dateTabs}>
        {DATES.map((d) => (
          <TouchableOpacity
            key={d.value}
            style={[styles.dateTab, selectedDay === d.value && styles.dateTabActive]}
            onPress={() => setSelectedDay(d.value)}
          >
            <Text
              style={[
                styles.dateTabText,
                selectedDay === d.value && styles.dateTabTextActive,
              ]}
            >
              {d.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#00C896" />
          <Text style={styles.loadingText}>Loading slots...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchSlots}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : slots.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No slots for this date</Text>
          <Text style={styles.emptySubtext}>
            Slots are generated automatically for active pumps
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {slots.map(renderSlotRow)}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Deactivation Modal */}
      <Modal
        visible={!!deactivateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setDeactivateModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Deactivate slot?</Text>
            {deactivateModal ? (
              <Text style={styles.modalSlotTime}>
                {formatTime(deactivateModal.start_time)} – {formatTime(deactivateModal.end_time)}
              </Text>
            ) : null}

            <Text style={styles.modalLabel}>Select reason:</Text>

            {/* Quick reason chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipsScroll}
            >
              {REASON_CHIPS.map((chip) => (
                <TouchableOpacity
                  key={chip}
                  style={[styles.chip, reason === chip && styles.chipSelected]}
                  onPress={() => setReason(chip)}
                >
                  <Text
                    style={[styles.chipText, reason === chip && styles.chipTextSelected]}
                  >
                    {chip}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.modalLabel}>Or type custom reason:</Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="e.g. CNG exhausted, truck arrives at 2 PM..."
              placeholderTextColor="#6B7280"
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={3}
            />

            <Text style={styles.modalLabel}>Slots resume from (optional):</Text>
            <TextInput
              style={styles.resumeInput}
              placeholder="e.g. 3:30 PM"
              placeholderTextColor="#6B7280"
              value={resumeTime}
              onChangeText={setResumeTime}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setDeactivateModal(null)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, saving && styles.btnDisabled]}
                onPress={handleDeactivate}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.confirmBtnText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#111827',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dateTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  dateTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#1F2937',
    alignItems: 'center',
  },
  dateTabActive: {
    backgroundColor: '#00C896',
  },
  dateTabText: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '600',
  },
  dateTabTextActive: {
    color: '#FFFFFF',
  },
  list: { flex: 1 },
  listContent: {
    padding: 16,
  },
  slotCard: {
    backgroundColor: '#1F2937',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  slotCardInactive: {
    opacity: 0.75,
    borderColor: '#F59E0B',
  },
  slotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  slotTime: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  progressBg: {
    flex: 1,
    height: 6,
    backgroundColor: '#374151',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  progressText: {
    color: '#9CA3AF',
    fontSize: 12,
    minWidth: 70,
  },
  capacityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  capacityLabel: {
    color: '#9CA3AF',
    fontSize: 13,
    flex: 1,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  capacityNum: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    minWidth: 24,
    textAlign: 'center',
  },
  reasonBox: {
    marginTop: 12,
    padding: 10,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
  },
  reasonText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '500',
  },
  resumeText: {
    color: '#9CA3AF',
    fontSize: 11,
    marginTop: 4,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    color: '#9CA3AF',
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: '#00C896',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#1F2937',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalSlotTime: {
    color: '#00C896',
    fontSize: 14,
    marginBottom: 20,
  },
  modalLabel: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  chipsScroll: {
    flexGrow: 0,
    marginBottom: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#374151',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#4B5563',
  },
  chipSelected: {
    backgroundColor: 'rgba(0,200,150,0.15)',
    borderColor: '#00C896',
  },
  chipText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#00C896',
  },
  reasonInput: {
    backgroundColor: '#111827',
    borderRadius: 10,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#374151',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  resumeInput: {
    backgroundColor: '#111827',
    borderRadius: 10,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#374151',
    height: 48,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#374151',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#9CA3AF',
    fontWeight: '700',
    fontSize: 15,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  btnDisabled: { opacity: 0.6 },
});
