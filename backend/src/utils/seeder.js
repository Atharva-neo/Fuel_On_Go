const Pump = require('../models/Pump');
const { generateSlotsForAllPumps } = require('./slotGenerator');

const KOLHAPUR_PUMPS = [
  {
    name: 'Mahadwar Road CNG',
    address: 'Mahadwar Rd, Kolhapur',
    location: { lat: 16.7008, lng: 74.2278 },
    cngLevel: 85,
    isActive: true,
    operatingHours: { open: '08:00', close: '20:00' },
    slotDuration: 30,
    slotCapacity: 5,
    bufferMinutes: 5,
    cngPricePerKg: 89.0,
  },
  {
    name: 'Rajaram Road CNG',
    address: 'Rajaram Rd, Kolhapur',
    location: { lat: 16.7054, lng: 74.2372 },
    cngLevel: 70,
    isActive: true,
    operatingHours: { open: '07:00', close: '21:00' },
    slotDuration: 30,
    slotCapacity: 5,
    bufferMinutes: 5,
    cngPricePerKg: 89.0,
  },
  {
    name: 'Kasba Bawada CNG',
    address: 'Kasba Bawada, Kolhapur',
    location: { lat: 16.6923, lng: 74.2441 },
    cngLevel: 60,
    isActive: true,
    operatingHours: { open: '08:00', close: '20:00' },
    slotDuration: 30,
    slotCapacity: 4,
    bufferMinutes: 5,
    cngPricePerKg: 89.0,
  },
  {
    name: 'Tarabai Park CNG',
    address: 'Tarabai Park, Kolhapur',
    location: { lat: 16.7124, lng: 74.2489 },
    cngLevel: 90,
    isActive: true,
    operatingHours: { open: '06:00', close: '22:00' },
    slotDuration: 30,
    slotCapacity: 5,
    bufferMinutes: 5,
    cngPricePerKg: 88.5,
  },
  {
    name: 'Shahupuri CNG',
    address: 'Shahupuri, Kolhapur',
    location: { lat: 16.7021, lng: 74.2198 },
    cngLevel: 75,
    isActive: true,
    operatingHours: { open: '08:00', close: '20:00' },
    slotDuration: 30,
    slotCapacity: 5,
    bufferMinutes: 5,
    cngPricePerKg: 89.0,
  },
  {
    name: 'Rajarampuri CNG',
    address: 'Rajarampuri, Kolhapur',
    location: { lat: 16.6989, lng: 74.2301 },
    cngLevel: 65,
    isActive: true,
    operatingHours: { open: '08:00', close: '20:00' },
    slotDuration: 30,
    slotCapacity: 4,
    bufferMinutes: 5,
    cngPricePerKg: 89.0,
  },
  {
    name: 'Jaysingpur CNG',
    address: 'Jaysingpur, Kolhapur dist',
    location: { lat: 16.7934, lng: 74.5578 },
    cngLevel: 80,
    isActive: true,
    operatingHours: { open: '07:00', close: '21:00' },
    slotDuration: 30,
    slotCapacity: 5,
    bufferMinutes: 5,
    cngPricePerKg: 88.0,
  },
  {
    name: 'Ichalkaranji CNG',
    address: 'Ichalkaranji, Kolhapur dist',
    location: { lat: 16.6939, lng: 74.4587 },
    cngLevel: 78,
    isActive: true,
    operatingHours: { open: '08:00', close: '20:00' },
    slotDuration: 30,
    slotCapacity: 5,
    bufferMinutes: 5,
    cngPricePerKg: 88.5,
  },
];

async function seedIfEmpty() {
  const count = await Pump.countDocuments();
  if (count > 0) {
    console.log(`[Seeder] ${count} pumps already in DB, skipping seed`);
    // Still ensure slots for next 7 days
    const pumps = await Pump.find({ isActive: true }).lean();
    await generateSlotsForAllPumps(pumps, 7);
    console.log('[Seeder] Ensured slots for next 7 days');
    return;
  }

  console.log('[Seeder] No pumps found — seeding Kolhapur CNG pumps...');
  const pumps = await Pump.insertMany(KOLHAPUR_PUMPS);
  console.log(`[Seeder] Created ${pumps.length} pumps`);

  await generateSlotsForAllPumps(pumps, 7);
  console.log('[Seeder] Generated slots for next 7 days');
}

module.exports = { seedIfEmpty };
