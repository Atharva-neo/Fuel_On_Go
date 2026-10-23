function createSupabaseSlotStore(supabase) {
  const ok = ({ data, error }) => {
    if (error) throw error;
    return data;
  };
  return {
    async listSlots(pumpId, date) {
      return (
        ok(
          await supabase
            .from('slots')
            .select('id, slot_date, start_time, end_time, capacity, booked_count, is_deactivated, deactivation_reason')
            .eq('pump_id', pumpId)
            .eq('slot_date', date)
            .order('start_time', { ascending: true })
        ) || []
      );
    },

    async slotIdsWithBookings(ids) {
      if (!ids.length) return new Set();
      const rows = ok(await supabase.from('bookings').select('slot_id').in('slot_id', ids)) || [];
      return new Set(rows.map((r) => r.slot_id));
    },

    // UNIQUE (pump_id, slot_date, start_time): concurrent generators cannot create duplicates.
    async insertSlots(rows) {
      ok(await supabase.from('slots').upsert(rows, { onConflict: 'pump_id,slot_date,start_time', ignoreDuplicates: true }));
    },

    async deleteSlots(ids) {
      ok(await supabase.from('slots').delete().in('id', ids));
    },

    async updateCapacity(id, capacity) {
      ok(await supabase.from('slots').update({ capacity }).eq('id', id));
    },
  };
}

module.exports = { createSupabaseSlotStore };
