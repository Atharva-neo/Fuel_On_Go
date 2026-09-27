import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { adminService } from '../../services/admin.service';

export default function CNGUpdateScreen() {
  const [pumpId, setPumpId] = useState<string>('');
  const [price, setPrice] = useState('89.50');
  const [density, setDensity] = useState('0.75');
  const [supplyStatus, setSupplyStatus] = useState<'available' | 'low' | 'interrupted'>('available');
  const [message, setMessage] = useState('');

  useEffect(() => {
    adminService
      .getMyPump()
      .then((d) => {
        if (d?.pump?.id) {
          setPumpId(d.pump.id);
          setPrice(String(d.pump.cng_price_per_kg || '89.50'));
          setDensity(String(d.pump.fuel_density || '0.75'));
          setSupplyStatus(d.pump.supply_status || 'available');
          setMessage(d.pump.public_message || '');
        }
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    if (!pumpId) {
      Alert.alert('No pump', 'Please add a pump first.');
      return;
    }

    try {
      await adminService.updatePump(pumpId, {
        cng_price_per_kg: Number(price),
        fuel_density: Number(density),
        supply_status: supplyStatus,
        public_message: message,
      });
      Alert.alert('Saved', 'Pump CNG details updated.');
    } catch (error: any) {
      Alert.alert('Failed', error?.response?.data?.error || 'Could not save updates.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Update CNG</Text>

      <Text style={styles.label}>CNG Price (?/kg)</Text>
      <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />

      <Text style={styles.label}>Fuel Density</Text>
      <TextInput style={styles.input} value={density} onChangeText={setDensity} keyboardType="decimal-pad" />

      <Text style={styles.label}>Supply Status</Text>
      <View style={styles.row}>
        {(['available', 'low', 'interrupted'] as const).map((s) => (
          <TouchableOpacity key={s} style={[styles.chip, supplyStatus === s && styles.chipActive]} onPress={() => setSupplyStatus(s)}>
            <Text style={[styles.chipText, supplyStatus === s && styles.chipTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Public Message</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={message}
        onChangeText={setMessage}
        multiline
        placeholder="Optional note for users"
      />

      <TouchableOpacity style={styles.saveBtn} onPress={save}>
        <Text style={styles.saveText}>Save</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  title: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 24,
    marginBottom: 12,
  },
  label: {
    color: '#475569',
    marginBottom: 6,
    fontSize: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 12,
  },
  multiline: {
    height: 90,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: '#0ea5e9',
    borderColor: '#0ea5e9',
  },
  chipText: {
    color: '#334155',
    textTransform: 'capitalize',
    fontWeight: '600',
    fontSize: 12,
  },
  chipTextActive: {
    color: '#fff',
  },
  saveBtn: {
    backgroundColor: '#0ea5e9',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 12,
  },
  saveText: {
    color: '#fff',
    fontWeight: '700',
  },
});
