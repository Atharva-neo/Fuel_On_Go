import React, { useMemo, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import api from '../config/api';import { useTheme, type Theme } from '../theme';


interface Slot {
  id: string | number;
  start_time: string;
  end_time: string;
  booked_count: number;
  capacity: number;
}

const SlotManagementScreen = () => {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSlots = async () => {
      try {
        const response = await api.get('/pumps/my-slots');
        setSlots(response.data);
      } catch (error) {
        console.error('Error fetching slots:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSlots();
  }, []);

  const handleCapacityChange = async (slotId: string | number, newCapacity: number) => {
    try {
      await api.patch(`/slots/${slotId}/capacity`, {
        capacity: newCapacity,
      });
      setSlots((prevSlots) =>
        prevSlots.map((slot) =>
          slot.id === slotId ? { ...slot, capacity: newCapacity } : slot
        )
      );
    } catch (error) {
      console.error('Error updating capacity:', error);
    }
  };

  const renderSlot = ({ item }: { item: Slot }) => (
    <View style={styles.slotCard}>
      <Text style={styles.slotText}>Time: {item.start_time} - {item.end_time}</Text>
      <Text style={styles.slotText}>Booked: {item.booked_count} / Capacity: {item.capacity}</Text>

      <View style={styles.capacityContainer}>
        <TouchableOpacity
          style={styles.capacityButton}
          onPress={() => handleCapacityChange(item.id, Math.max(1, item.capacity - 1))}
        >
          <Text style={styles.capacityButtonText}>-</Text>
        </TouchableOpacity>

        <TextInput
          style={styles.capacityInput}
          value={item.capacity.toString()}
          keyboardType="number-pad"
          onChangeText={(text) => handleCapacityChange(item.id, parseInt(text) || 1)}
        />

        <TouchableOpacity
          style={styles.capacityButton}
          onPress={() => handleCapacityChange(item.id, item.capacity + 1)}
        >
          <Text style={styles.capacityButtonText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return <Text>Loading slots...</Text>;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={slots}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderSlot}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
};

const createStyles = (t: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.colors.surfaceAlt,
    padding: 10,
  },
  listContainer: {
    paddingBottom: 20,
  },
  slotCard: {
    backgroundColor: t.colors.surface,
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    shadowColor: t.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  slotText: {
    fontSize: 16,
    marginBottom: 5,
  },
  capacityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  capacityButton: {
    backgroundColor: t.colors.brand,
    padding: 10,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  capacityButtonText: {
    color: t.colors.onBrand,
    fontSize: 16,
    fontWeight: 'bold',
  },
  capacityInput: {
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: 8,
    padding: 5,
    textAlign: 'center',
    width: 50,
    backgroundColor: t.colors.surface,
  },
});

export default SlotManagementScreen;