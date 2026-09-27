import { supabase } from './supabase';
import { addDays, setHours, setMinutes, startOfDay } from 'date-fns';

const MOCK_PUMPS = [
  { name: 'MGL CNG Pump BKC', address: 'Bandra Kurla Complex, Mumbai', lat: 19.0658, lng: 72.8687, fuel_density: 220, cng_price: 76.0 },
  { name: 'Adani CNG Station Andheri', address: 'Andheri East, Mumbai', lat: 19.1136, lng: 72.8697, fuel_density: 215, cng_price: 76.0 },
  { name: 'Torrent CNG Goregaon', address: 'Goregaon West, Mumbai', lat: 19.1645, lng: 72.8461, fuel_density: 210, cng_price: 76.0 },
];

export async function seedPumpsAndSlots() {
  console.log('Seeding pumps...');
  for (const pump of MOCK_PUMPS) {
    const { data: existing } = await supabase.from('pumps').select('id').eq('name', pump.name).single();
    let pumpId = existing?.id;
    if (!pumpId) {
      const { data, error } = await supabase.from('pumps').insert([pump]).select('id').single();
      if (error) console.error('Error inserting pump:', error);
      if (data) pumpId = data.id;
    }

    if (pumpId) {
      console.log(`Generating slots for pump ${pumpId}...`);
      await generateSlotsForPump(pumpId);
    }
  }
  console.log('Seeding complete.');
}

async function generateSlotsForPump(pumpId: string) {
  const today = startOfDay(new Date());
  
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const targetDay = addDays(today, dayOffset);
    let start = setMinutes(setHours(targetDay, 6), 0); // 06:00
    const end = setMinutes(setHours(targetDay, 22), 0); // 22:00

    const slots = [];
    while (start < end) {
      const endTime = addDays(start, 0); // copy date
      endTime.setMinutes(endTime.getMinutes() + 30);
      
      slots.push({
        pump_id: pumpId,
        start_time: start.toISOString(),
        end_time: endTime.toISOString(),
        capacity: 5,
        booked_count: 0,
        status: 'open'
      });
      
      start = endTime;
    }
    
    // Insert ignoring duplicates (on conflict do nothing)
    const { error } = await supabase.from('slots').upsert(slots, { onConflict: 'pump_id, start_time', ignoreDuplicates: true });
    if (error) {
      console.error('Error inserting slots:', error);
    }
  }
}
