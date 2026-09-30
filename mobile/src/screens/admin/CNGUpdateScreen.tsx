import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { adminService } from '../../services/admin.service';
import { ArrowLeftIcon } from '../../components/ui/Icons';

export default function CNGUpdateScreen({ navigation }: any) {
  const [pumpId, setPumpId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [openingTime, setOpeningTime] = useState('06:00');
  const [closingTime, setClosingTime] = useState('22:00');
  const [vehiclesPerSlot, setVehiclesPerSlot] = useState(5);
  const [price, setPrice] = useState('89.50');
  const [density, setDensity] = useState('0.75');
  const [supplyStatus, setSupplyStatus] = useState<'available' | 'low' | 'interrupted'>('available');
  const [message, setMessage] = useState('');

  useEffect(() => {
    adminService
      .getMyPump()
      .then((d) => {
        const p = d?.pump;
        if (p?.id) {
          setPumpId(p.id);
          setName(p.name || '');
          setAddress(p.address || '');
          setCity(p.city || '');
          setDistrict(p.district || '');
          setPinCode(p.pin_code || '');
          setOpeningTime(p.working_hours_start || '06:00');
          setClosingTime(p.working_hours_end || '22:00');
          setVehiclesPerSlot(Number(p.vehicles_per_slot) || 5);
          setPrice(String(p.cng_price_per_kg || '89.50'));
          setDensity(String(p.fuel_density || '0.75'));
          setSupplyStatus(p.supply_status || 'available');
          setMessage(p.public_message || '');
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!pumpId) {
      Alert.alert('No pump', 'Please register a pump first.');
      return;
    }
    if (!name.trim() || !address.trim() || !city.trim() || !district.trim()) {
      Alert.alert('Missing fields', 'Name, address, city and district are required.');
      return;
    }

    setSaving(true);
    try {
      await adminService.updatePump(pumpId, {
        name: name.trim(),
        address: address.trim(),
        city: city.trim(),
        district: district.trim(),
        pin_code: pinCode.trim() || undefined,
        working_hours_start: openingTime,
        working_hours_end: closingTime,
        vehicles_per_slot: vehiclesPerSlot,
        cng_price_per_kg: Number(price),
        fuel_density: Number(density),
        supply_status: supplyStatus,
        public_message: message,
      });
      Alert.alert('Saved', 'Pump details updated.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert('Failed', error?.response?.data?.error || 'Could not save updates.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#00C896" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeftIcon size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Edit Pump</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.label}>Pump Name*</Text>
          <TextInput style={styles.input} placeholderTextColor="#6B7280" value={name} onChangeText={setName} />

          <Text style={styles.label}>Address*</Text>
          <TextInput style={styles.input} placeholderTextColor="#6B7280" value={address} onChangeText={setAddress} />

          <Text style={styles.label}>City*</Text>
          <TextInput style={styles.input} placeholderTextColor="#6B7280" value={city} onChangeText={setCity} />

          <Text style={styles.label}>District*</Text>
          <TextInput style={styles.input} placeholderTextColor="#6B7280" value={district} onChangeText={setDistrict} />

          <Text style={styles.label}>PIN Code</Text>
          <TextInput
            style={[styles.input, { marginBottom: 0 }]}
            placeholderTextColor="#6B7280"
            value={pinCode}
            onChangeText={setPinCode}
            keyboardType="number-pad"
          />
        </View>

        <View style={styles.card}>
          <View style={styles.timeRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Opening Time*</Text>
              <TextInput style={styles.input} placeholderTextColor="#6B7280" value={openingTime} onChangeText={setOpeningTime} placeholder="06:00" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Closing Time*</Text>
              <TextInput style={styles.input} placeholderTextColor="#6B7280" value={closingTime} onChangeText={setClosingTime} placeholder="22:00" />
            </View>
          </View>

          <Text style={styles.label}>Vehicles per slot</Text>
          <View style={styles.stepper}>
            <TouchableOpacity style={styles.stepBtn} onPress={() => setVehiclesPerSlot((v) => Math.max(1, v - 1))}>
              <Text style={styles.stepText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.stepValue}>{vehiclesPerSlot}</Text>
            <TouchableOpacity style={styles.stepBtn} onPress={() => setVehiclesPerSlot((v) => v + 1)}>
              <Text style={styles.stepText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>CNG Price (₹/kg)*</Text>
          <TextInput style={styles.input} placeholderTextColor="#6B7280" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />

          <Text style={styles.label}>Fuel Density</Text>
          <TextInput style={styles.input} placeholderTextColor="#6B7280" value={density} onChangeText={setDensity} keyboardType="decimal-pad" />

          <Text style={styles.label}>Supply Status</Text>
          <View style={styles.chipRow}>
            {(['available', 'low', 'interrupted'] as const).map((s) => (
              <TouchableOpacity key={s} style={[styles.chip, supplyStatus === s && styles.chipActive]} onPress={() => setSupplyStatus(s)}>
                <Text style={[styles.chipText, supplyStatus === s && styles.chipTextActive]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Public Message</Text>
          <TextInput
            style={[styles.input, styles.multiline, { marginBottom: 0 }]}
            placeholderTextColor="#6B7280"
            value={message}
            onChangeText={setMessage}
            multiline
            placeholder="Optional note shown to customers"
          />
        </View>

        <TouchableOpacity style={[styles.submitBtn, saving && styles.submitBtnDisabled]} onPress={save} disabled={saving}>
          <Text style={styles.submitText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  loader: {
    flex: 1,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#111827',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 22,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#1F2937',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  label: {
    color: '#9CA3AF',
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: '#111827',
    color: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 46,
    marginBottom: 16,
    fontSize: 15,
  },
  multiline: {
    height: 90,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stepValue: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
    minWidth: 20,
    textAlign: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: '#00C896',
    borderColor: '#00C896',
  },
  chipText: {
    color: '#9CA3AF',
    textTransform: 'capitalize',
    fontWeight: '600',
    fontSize: 12,
  },
  chipTextActive: {
    color: '#0A0A0A',
  },
  submitBtn: {
    backgroundColor: '#00C896',
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 16,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitText: {
    color: '#0A0A0A',
    fontWeight: '800',
    fontSize: 16,
  },
});
