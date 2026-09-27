const fs = require('fs');

async function generatePumps() {
  try {
    let sql = `INSERT INTO public.pumps (name, address, city, district, lat, lng, cng_price_per_kg, vehicles_per_slot, is_active) VALUES\n`;
    const values = [];
    
    // Base coords around Pune/Mumbai
    const baseLat = 18.5204;
    const baseLng = 73.8567;

    for (let i = 1; i <= 100; i++) {
      const lat = baseLat + (Math.random() - 0.5) * 2; // +/- 1 degree
      const lng = baseLng + (Math.random() - 0.5) * 2;
      
      const name = `Maha CNG Station ${i}`;
      const address = `Street ${i}, Maharashtra`;
      const city = i % 2 === 0 ? 'Pune' : 'Mumbai';
      const district = city;
      
      values.push(`('${name}', '${address}', '${city}', '${district}', ${lat.toFixed(6)}, ${lng.toFixed(6)}, 89.00, 5, TRUE)`);
    }
    
    sql += values.join(',\n') + `\nON CONFLICT (name) DO NOTHING;\n\n`;
    
    sql += `
DO $$
DECLARE
  p RECORD;
  d INTEGER;
BEGIN
  FOR p IN SELECT id FROM public.pumps WHERE is_active = TRUE LOOP
    FOR d IN 0..6 LOOP
      PERFORM public.generate_daily_slots(p.id, CURRENT_DATE + d);
    END LOOP;
  END LOOP;
  RAISE NOTICE 'Slot generation complete for 7 days';
END;
$$;
`;

    fs.writeFileSync('seed_100_pumps.sql', sql);
    console.log('SQL generated: seed_100_pumps.sql');
  } catch(e) {
    console.error(e);
  }
}

generatePumps();
