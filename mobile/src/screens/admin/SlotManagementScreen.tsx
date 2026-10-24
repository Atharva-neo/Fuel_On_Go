import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
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
import { AlertIcon } from '../../components/ui/Icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme, type Theme } from '../../theme';
import { istDate } from '../../utils/schedule';
import { langStore } from '../../i18n';
import { formatClock, formatInstantTime } from '../../i18n/format';
import { apiErrorMessage } from '../../i18n/errors';
import { useT } from '../../i18n';

const DATES = [
  { key: 'slots.today', value: 0 },
  { key: 'slots.tomorrow', value: 1 },
  { key: 'slots.dayAfter', value: 2 },
];

// Dates are India Standard Time, like the server (a UTC date is wrong for ~5.5 h every day).
function getDateString(offset: number) {
  return istDate(offset);
}

function formatTime(isoString: string) {
  if (!isoString) return '';
  const lang = langStore.getState().language;
  // Handle both "HH:MM:SS" wall-clock times (IST, as stored) and full ISO timestamps
  if (isoString.includes('T') || isoString.includes(' ')) return formatInstantTime(isoString, lang);
  return formatClock(isoString, lang);
}

function parseHM(hms: string): [number, number] {
  const [h, m] = String(hms || '00:00').split(':').map((n) => Number(n) || 0);
  return [h, m];
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function to12Hour(h: number, m: number) {
  return formatClock(`${pad2(h)}:${pad2(m)}`, langStore.getState().language);
}

const REASON_CHIPS = ['slots.reason.supplyOver', 'slots.reason.maintenance', 'slots.reason.truck', 'slots.reason.technical', 'slots.reason.weather'];

export default function SlotManagementScreen() {
  const t = useTheme();
  const { tr } = useT();
  const styles = useMemo(() => createStyles(t), [t]);
  const [selectedDay, setSelectedDay] = useState(0);
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<{ open: string; close: string; overnight: boolean } | null>(null);
  const [deactivateModal, setDeactivateModal] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [resumeTime, setResumeTime] = useState('');
  const [saving, setSaving] = useState(false);
  const [editTimeModal, setEditTimeModal] = useState<any>(null);
  const [startH, setStartH] = useState(0);
  const [startM, setStartM] = useState(0);

  const fetchSlots = async () => {
    setLoading(true);
    setError(null);
    try {
      const date = getDateString(selectedDay);
      const res = await api.get(`/admin/slots?date=${date}`);
      setSlots(res.data.slots || res.data || []);
      setSchedule(res.data.schedule || null);
    } catch (err: any) {
      const msg = apiErrorMessage(err, tr, 'slots.loadFailed');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSlots();
  }, [selectedDay]);

  // Coming back from Edit Pump (new hours saved) must show the regenerated slots, not a stale list.
  useFocusEffect(
    useCallback(() => {
      fetchSlots();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDay])
  );

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
      Alert.alert(tr('common.error'), apiErrorMessage(err, tr, 'slots.activateFailed'));
    }
  };

  const handleDeactivate = async () => {
    if (!reason.trim()) {
      Alert.alert(tr('slots.reasonRequiredTitle'), tr('slots.reasonRequired'));
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
      Alert.alert(tr('common.error'), apiErrorMessage(err, tr, 'slots.deactivateFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleCapacityChange = async (slot: any, delta: number) => {
    const newCap = (slot.capacity || 5) + delta;
    if (newCap < 1) return;
    const booked = slot.booked_count || 0;
    if (newCap < booked) {
      Alert.alert(tr('slots.cannotReduceTitle'), tr('slots.cannotReduce', { count: booked }));
      return;
    }
    try {
      await api.patch(`/slots/${slot.id}/capacity`, { capacity: newCap });
      // Optimistic update
      setSlots((prev) =>
        prev.map((s) => (s.id === slot.id ? { ...s, capacity: newCap } : s))
      );
    } catch (err: any) {
      Alert.alert(tr('common.error'), tr('slots.capacityFailed'));
    }
  };

  const openEditTime = (slot: any) => {
    const [sh, sm] = parseHM(slot.start_time);
    setStartH(sh);
    setStartM(sm);
    setEditTimeModal(slot);
  };

  const stepStart = (delta: number) => {
    let total = startH * 60 + startM + delta;
    total = ((total % 1440) + 1440) % 1440; // wrap 0-1439
    setStartH(Math.floor(total / 60));
    setStartM(total % 60);
  };

  // Every slot is a fixed 30-minute duration, so the end time is always
  // derived from the start -- there's nothing separate to set or get wrong.
  const derivedEndTotal = (startH * 60 + startM + 30) % 1440;
  const derivedEndH = Math.floor(derivedEndTotal / 60);
  const derivedEndM = derivedEndTotal % 60;

  const handleSaveTime = async () => {
    const startTime = `${pad2(startH)}:${pad2(startM)}`;
    setSaving(true);
    try {
      await api.patch(`/slots/${editTimeModal.id}/time`, {
        start_time: startTime,
      });
      setEditTimeModal(null);
      fetchSlots();
    } catch (err: any) {
      Alert.alert(tr('common.error'), apiErrorMessage(err, tr, 'slots.timeFailed'));
    } finally {
      setSaving(false);
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
          <TouchableOpacity
            style={styles.slotTimeRow}
            disabled={booked > 0}
            onPress={() => openEditTime(slot)}
          >
            <Text style={styles.slotTime}>
              {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
            </Text>
            {booked === 0 ? (
              <MaterialCommunityIcons name="pencil-outline" size={16} color={t.colors.textMuted} />
            ) : null}
          </TouchableOpacity>
          <Switch
            value={isActive}
            onValueChange={() => handleToggle(slot)}
            trackColor={{ false: t.colors.textSecondary, true: t.colors.brandText }}
            thumbColor={isActive ? t.colors.text : t.colors.textMuted}
            ios_backgroundColor={t.colors.textSecondary}
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
                  backgroundColor: isFull ? t.colors.danger : booked > 0 ? t.colors.warning : t.colors.brand,
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>{tr('slots.booked', { booked, cap })}</Text>
        </View>

        {/* Capacity stepper */}
        <View style={styles.capacityRow}>
          <Text style={styles.capacityLabel}>{tr('slots.capacity')}</Text>
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
            <View style={styles.reasonRow}>
              <AlertIcon size={12} color={t.colors.warningText} />
              <Text style={styles.reasonText}>{slot.deactivation_reason}</Text>
            </View>
            {slot.resume_time ? (
              <Text style={styles.resumeText}>{tr('slots.resumes', { time: slot.resume_time })}</Text>
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
        <Text style={styles.headerTitle}>{tr('slots.title')}</Text>
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
              {tr(d.key)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {schedule ? (
        <Text style={styles.scheduleHint}>
          {tr('slots.operatingHours', { open: schedule.open, close: schedule.close })}
          {schedule.overnight ? ` ${tr('slots.overnight')}` : ''}
        </Text>
      ) : null}

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={t.colors.brandText} />
          <Text style={styles.loadingText}>{tr('slots.loading')}</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchSlots}>
            <Text style={styles.retryText}>{tr('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : slots.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>{tr('slots.none')}</Text>
          <Text style={styles.emptySubtext}>
            {schedule
              ? tr('slots.noneWithHours', { open: schedule.open, close: schedule.close })
              : tr('slots.autoGenerated')}
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchSlots}>
            <Text style={styles.retryText}>{tr('slots.refresh')}</Text>
          </TouchableOpacity>
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
            <Text style={styles.modalTitle}>{tr('slots.deactivateTitle')}</Text>
            {deactivateModal ? (
              <Text style={styles.modalSlotTime}>
                {formatTime(deactivateModal.start_time)} – {formatTime(deactivateModal.end_time)}
              </Text>
            ) : null}

            <Text style={styles.modalLabel}>{tr('slots.selectReason')}</Text>

            {/* Quick reason chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipsScroll}
            >
              {REASON_CHIPS.map((chipKey) => {
                const chip = tr(chipKey);
                return (
                  <TouchableOpacity
                    key={chipKey}
                    style={[styles.chip, reason === chip && styles.chipSelected]}
                    onPress={() => setReason(chip)}
                  >
                    <Text
                      style={[styles.chipText, reason === chip && styles.chipTextSelected]}
                    >
                      {chip}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.modalLabel}>{tr('slots.customReason')}</Text>
            <TextInput
              style={styles.reasonInput}
              placeholder={tr('slots.reasonPlaceholder')}
              placeholderTextColor={t.colors.placeholder}
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={3}
            />

            <Text style={styles.modalLabel}>{tr('slots.resumeFrom')}</Text>
            <TextInput
              style={styles.resumeInput}
              placeholder={tr('slots.resumePlaceholder')}
              placeholderTextColor={t.colors.placeholder}
              value={resumeTime}
              onChangeText={setResumeTime}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setDeactivateModal(null)}
              >
                <Text style={styles.cancelBtnText}>{tr('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, saving && styles.btnDisabled]}
                onPress={handleDeactivate}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={t.colors.onDanger} size="small" />
                ) : (
                  <Text style={styles.confirmBtnText}>{tr('common.confirm')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Time Modal */}
      <Modal
        visible={!!editTimeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setEditTimeModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{tr('slots.editTime')}</Text>
            <Text style={styles.modalSlotTime}>
              {to12Hour(startH, startM)} – {to12Hour(derivedEndH, derivedEndM)}
            </Text>
            <Text style={styles.modalHint}>{tr('slots.editHint')}</Text>

            <Text style={styles.modalLabel}>{tr('slots.startTime')}</Text>
            <View style={styles.timeStepperRow}>
              <TouchableOpacity style={styles.timeStepBtn} onPress={() => stepStart(-30)}>
                <Text style={styles.timeStepBtnText}>{tr('slots.minus30')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.timeStepBtn} onPress={() => stepStart(-5)}>
                <Text style={styles.timeStepBtnText}>{tr('slots.minus5')}</Text>
              </TouchableOpacity>
              <Text style={styles.timeDisplay}>{pad2(startH)}:{pad2(startM)}</Text>
              <TouchableOpacity style={styles.timeStepBtn} onPress={() => stepStart(5)}>
                <Text style={styles.timeStepBtnText}>{tr('slots.plus5')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.timeStepBtn} onPress={() => stepStart(30)}>
                <Text style={styles.timeStepBtnText}>{tr('slots.plus30')}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>{tr('slots.endAuto')}</Text>
            <Text style={styles.timeDisplayReadonly}>{pad2(derivedEndH)}:{pad2(derivedEndM)}</Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setEditTimeModal(null)}
              >
                <Text style={styles.cancelBtnText}>{tr('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveTimeBtn, saving && styles.btnDisabled]}
                onPress={handleSaveTime}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={t.colors.onDanger} size="small" />
                ) : (
                  <Text style={styles.confirmBtnText}>{tr('slots.save')}</Text>
                )}
              </TouchableOpacity>
            </View>
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
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: t.colors.bg,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: t.colors.text,
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
    backgroundColor: t.colors.surface,
    alignItems: 'center',
  },
  dateTabActive: {
    backgroundColor: t.colors.brand,
  },
  dateTabText: {
    color: t.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  dateTabTextActive: {
    color: t.colors.text,
  },
  list: { flex: 1 },
  listContent: {
    padding: 16,
  },
  slotCard: {
    backgroundColor: t.colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  slotCardInactive: {
    opacity: 0.75,
    borderColor: t.colors.warning,
  },
  slotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  slotTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  slotTime: {
    fontSize: 16,
    fontWeight: '700',
    color: t.colors.text,
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
    backgroundColor: t.colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  progressText: {
    color: t.colors.textMuted,
    fontSize: 12,
    minWidth: 70,
  },
  capacityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  capacityLabel: {
    color: t.colors.textMuted,
    fontSize: 13,
    flex: 1,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: t.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    color: t.colors.text,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  capacityNum: {
    color: t.colors.text,
    fontSize: 16,
    fontWeight: '700',
    minWidth: 24,
    textAlign: 'center',
  },
  reasonBox: {
    marginTop: 12,
    padding: 10,
    backgroundColor: t.colors.warningTint,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: t.colors.warning,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reasonText: {
    flex: 1,
    color: t.colors.warningText,
    fontSize: 12,
    fontWeight: '500',
  },
  resumeText: {
    color: t.colors.textMuted,
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
    color: t.colors.textMuted,
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    color: t.colors.dangerText,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: t.colors.brand,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  scheduleHint: {
    color: t.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  retryText: {
    color: t.colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  emptyText: {
    color: t.colors.text,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    color: t.colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  // Modal
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
  modalTitle: {
    color: t.colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalSlotTime: {
    color: t.colors.brandText,
    fontSize: 14,
    marginBottom: 20,
  },
  modalLabel: {
    color: t.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  modalHint: {
    color: t.colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 4,
  },
  chipsScroll: {
    flexGrow: 0,
    marginBottom: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: t.colors.border,
    marginRight: 8,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  chipSelected: {
    backgroundColor: t.colors.brandTint,
    borderColor: t.colors.brand,
  },
  chipText: {
    color: t.colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: t.colors.brandText,
  },
  reasonInput: {
    backgroundColor: t.colors.inputBg,
    borderRadius: 10,
    padding: 12,
    color: t.colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: t.colors.border,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  resumeInput: {
    backgroundColor: t.colors.inputBg,
    borderRadius: 10,
    padding: 12,
    color: t.colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: t.colors.border,
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
    backgroundColor: t.colors.border,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: t.colors.textMuted,
    fontWeight: '700',
    fontSize: 15,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: t.colors.danger,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: t.colors.onDanger,
    fontWeight: '700',
    fontSize: 15,
  },
  btnDisabled: { opacity: 0.6 },
  timeStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  timeStepBtn: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: t.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeStepBtnText: {
    color: t.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  timeDisplay: {
    color: t.colors.text,
    fontSize: 18,
    fontWeight: '800',
    minWidth: 64,
    textAlign: 'center',
  },
  timeDisplayReadonly: {
    color: t.colors.textMuted,
    fontSize: 18,
    fontWeight: '700',
    backgroundColor: t.colors.inputBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: t.colors.border,
    paddingVertical: 10,
    textAlign: 'center',
  },
  saveTimeBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: t.colors.brand,
    alignItems: 'center',
  },
});
