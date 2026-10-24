import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import PumpLocationPicker, { type ConfirmedPumpLocation } from '../../components/PumpLocationPicker';
import { pumpService } from '../../services/pump.service';
import { LocationIcon, ArrowLeftIcon } from '../../components/ui/Icons';
import OverflowMenu from '../../components/OverflowMenu';
import { apiErrorMessage } from '../../i18n/errors';
import { normalizeSchedule } from '../../utils/schedule';
import { useTheme, type Theme } from '../../theme';
import { useT } from '../../i18n';


export default function AddPumpScreen({ navigation }: any) {
  const t = useTheme();
  const { tr } = useT();
  const styles = useMemo(() => createStyles(t), [t]);
  const [pumpName, setPumpName] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [pinCode, setPinCode] = useState('');
  // Confirmed pump location (full-precision coordinates); the picker restores it when reopened.
  const [location, setLocation] = useState<ConfirmedPumpLocation | null>(null);
  const lat = location?.state.point?.lat ?? null;
  const lng = location?.state.point?.lng ?? null;
  // Remember what we auto-filled so we never overwrite text the owner typed.
  const autofilled = useRef({ address: '', city: '', district: '', pin: '' });
  const [openingTime, setOpeningTime] = useState('06:00');
  const [closingTime, setClosingTime] = useState('22:00');
  const [vehiclesPerSlot, setVehiclesPerSlot] = useState(5);
  const [cngPrice, setCngPrice] = useState('89.50');
  const [mapVisible, setMapVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const onLocationConfirmed = (loc: ConfirmedPumpLocation) => {
    setLocation(loc);
    setMapVisible(false);
    const fill = (current: string, previousAuto: string, next: string) =>
      !current.trim() || current === previousAuto ? next : current;
    const prev = autofilled.current;
    const nextAddr = loc.state.address ?? '';
    setAddress((c) => fill(c, prev.address, nextAddr));
    setCity((c) => fill(c, prev.city, loc.city));
    setDistrict((c) => fill(c, prev.district, loc.district));
    setPinCode((c) => fill(c, prev.pin, loc.postcode));
    autofilled.current = { address: nextAddr, city: loc.city, district: loc.district, pin: loc.postcode };
  };

  const onSubmit = async () => {
    if (!pumpName.trim() || !licenseNumber.trim() || !address.trim() || !city.trim() || !district.trim() || lat == null || lng == null) {
      Alert.alert(tr('pumpForm.missingTitle'), lat == null ? tr('pumpForm.missingLocation') : tr('pumpForm.missingAll'));
      return;
    }

    const schedule = normalizeSchedule(openingTime, closingTime);
    if (!schedule.ok) {
      Alert.alert(tr('schedule.checkHours'), tr(`schedule.${schedule.code}`));
      return;
    }

    setSaving(true);
    try {
      await pumpService.registerPump({
        name: pumpName.trim(),
        license_number: licenseNumber.trim(),
        address: address.trim(),
        city: city.trim(),
        district: district.trim(),
        pin_code: pinCode.trim() || undefined,
        lat: Number(lat),
        lng: Number(lng),
        working_hours_start: schedule.open,
        working_hours_end: schedule.close,
        vehicles_per_slot: vehiclesPerSlot,
        cng_price_per_kg: Number(cngPrice),
      });

      Alert.alert(tr('common.success'), tr('pumpForm.registerSuccess'), [
        {
          text: tr('common.ok'),
          onPress: () => navigation.navigate('AdminTabs', { screen: 'AdminDashboard' }),
        },
      ]);
    } catch (error: any) {
      Alert.alert(tr('pumpForm.failed'), apiErrorMessage(error, tr, 'pumpForm.registerFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeftIcon size={22} color={t.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { flex: 1 }]} numberOfLines={1}>{tr('pumpForm.registerTitle')}</Text>
        <OverflowMenu style={{ width: 40, height: 40, borderRadius: 20 }} offsetTop={60} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.label}>{tr('pumpForm.name')}</Text>
          <TextInput style={styles.input} placeholderTextColor={t.colors.placeholder} value={pumpName} onChangeText={setPumpName} />

          <Text style={styles.label}>{tr('pumpForm.license')}</Text>
          <TextInput style={styles.input} placeholderTextColor={t.colors.placeholder} value={licenseNumber} onChangeText={setLicenseNumber} />

          <Text style={styles.label}>{tr('pumpForm.address')}</Text>
          <TextInput style={styles.input} placeholderTextColor={t.colors.placeholder} value={address} onChangeText={setAddress} />

          <Text style={styles.label}>{tr('pumpForm.city')}</Text>
          <TextInput style={styles.input} placeholderTextColor={t.colors.placeholder} value={city} onChangeText={setCity} />

          <Text style={styles.label}>{tr('pumpForm.district')}</Text>
          <TextInput style={styles.input} placeholderTextColor={t.colors.placeholder} value={district} onChangeText={setDistrict} />

          <Text style={styles.label}>{tr('pumpForm.pin')}</Text>
          <TextInput
            style={[styles.input, { marginBottom: 0 }]}
            placeholderTextColor={t.colors.placeholder}
            value={pinCode}
            onChangeText={setPinCode}
            keyboardType="number-pad"
          />
        </View>

        <View style={styles.card}>
          <TouchableOpacity style={styles.mapBtn} onPress={() => setMapVisible(true)}>
            <Text style={styles.mapBtnText}>{lat != null ? tr('pumpForm.changeLocation') : tr('pumpForm.setLocation')}</Text>
          </TouchableOpacity>
          {lat != null && lng != null ? (
            <View style={styles.coordRow}>
              <LocationIcon size={12} color={t.colors.brandText} />
              <Text style={styles.coord}>{tr('pumpForm.locationSet', { lat: lat.toFixed(6), lng: lng.toFixed(6) })}</Text>
            </View>
          ) : (
            <Text style={styles.coordMuted}>{tr('pumpForm.locationHint')}</Text>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.timeRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{tr('pumpForm.opening')}</Text>
              <TextInput style={styles.input} placeholderTextColor={t.colors.placeholder} value={openingTime} onChangeText={setOpeningTime} placeholder="06:00" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{tr('pumpForm.closing')}</Text>
              <TextInput style={styles.input} placeholderTextColor={t.colors.placeholder} value={closingTime} onChangeText={setClosingTime} placeholder="22:00" />
            </View>
          </View>

          <Text style={styles.label}>{tr('pumpForm.vehiclesPerSlot')}</Text>
          <View style={styles.stepper}>
            <TouchableOpacity style={styles.stepBtn} onPress={() => setVehiclesPerSlot((v) => Math.max(1, v - 1))}>
              <Text style={styles.stepText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.stepValue}>{vehiclesPerSlot}</Text>
            <TouchableOpacity style={styles.stepBtn} onPress={() => setVehiclesPerSlot((v) => v + 1)}>
              <Text style={styles.stepText}>+</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>{tr('pumpForm.priceOptional')}</Text>
          <TextInput
            style={[styles.input, { marginBottom: 0 }]}
            placeholderTextColor={t.colors.placeholder}
            value={cngPrice}
            onChangeText={setCngPrice}
            keyboardType="decimal-pad"
          />
        </View>

        <TouchableOpacity style={[styles.submitBtn, saving && styles.submitBtnDisabled]} onPress={onSubmit} disabled={saving}>
          <Text style={styles.submitText}>{saving ? tr('pumpForm.registering') : tr('pumpForm.register')}</Text>
        </TouchableOpacity>
      </ScrollView>

      <PumpLocationPicker
        visible={mapVisible}
        initial={location}
        onConfirm={onLocationConfirmed}
        onClose={() => setMapVisible(false)}
      />
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: t.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: t.colors.text,
    fontWeight: '700',
    fontSize: 22,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: t.colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  label: {
    color: t.colors.textMuted,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.inputBg,
    color: t.colors.text,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 46,
    marginBottom: 16,
    fontSize: 15,
  },
  mapBtn: {
    backgroundColor: t.colors.brandTint,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: t.colors.brand,
  },
  mapBtnText: {
    color: t.colors.brandText,
    fontWeight: '700',
  },
  coordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  coord: {
    color: t.colors.textSecondary,
    fontSize: 13,
  },
  coordMuted: {
    color: t.colors.textSecondary,
    fontSize: 13,
    marginTop: 12,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: t.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    fontSize: 18,
    fontWeight: '700',
    color: t.colors.text,
  },
  stepValue: {
    color: t.colors.text,
    fontWeight: '700',
    fontSize: 16,
    minWidth: 20,
    textAlign: 'center',
  },
  submitBtn: {
    backgroundColor: t.colors.brand,
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 4,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitText: {
    color: t.colors.onBrand,
    fontWeight: '800',
    fontSize: 16,
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: t.colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  mapHeaderTitle: {
    color: t.colors.text,
    fontWeight: '700',
    flex: 1,
    marginRight: 12,
  },
  mapDoneBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: t.colors.brandTint,
  },
  mapDone: {
    color: t.colors.brandText,
    fontWeight: '700',
  },
});
