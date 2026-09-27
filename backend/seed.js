require('dotenv').config();
const mongoose = require('mongoose');
const Pump = require('./src/models/Pump');
const Slot = require('./src/models/Slot');
const User = require('./src/models/User');
const Booking = require('./src/models/Booking');
const { generateSlots } = require('./src/utils/slotGenerator');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cng_smart_slot';

const pumpsSeedData = [
  {
    name: 'IndianOil CNG - Banjara Hills',
    address: 'Road No. 12, Banjara Hills, Hyderabad, Telangana 500034',
    location: { lat: 17.4126, lng: 78.4261 },
    cngLevel: 82,
    isActive: true,
    operatorName: 'Ramesh Kumar',
    phone: '9876543210',
    operatingHours: { open: '06:00', close: '22:00' },
    slotDuration: 30,
    slotCapacity: 5,
    bufferMinutes: 0,
  },
  {
    name: 'HP CNG Station - Jubilee Hills',
    address: 'Check Post, Jubilee Hills, Hyderabad, Telangana 500033',
    location: { lat: 17.4319, lng: 78.4072 },
    cngLevel: 45,
    isActive: true,
    operatorName: 'Suresh Reddy',
    phone: '9876543211',
    operatingHours: { open: '06:00', close: '23:00' },
    slotDuration: 30,
    slotCapacity: 5,
    bufferMinutes: 0,
  },
  {
    name: 'HPCL CNG Pump - Madhapur',
    address: 'Hitech City Road, Madhapur, Hyderabad, Telangana 500081',
    location: { lat: 17.4504, lng: 78.3912 },
    cngLevel: 15,
    isActive: true,
    operatorName: 'Venkat Rao',
    phone: '9876543212',
    operatingHours: { open: '05:30', close: '23:30' },
    slotDuration: 30,
    slotCapacity: 5,
    bufferMinutes: 0,
  },
  {
    name: 'Bharat CNG - Gachibowli',
    address: 'DLF Cyber City Road, Gachibowli, Hyderabad, Telangana 500032',
    location: { lat: 17.4401, lng: 78.3489 },
    cngLevel: 70,
    isActive: true,
    operatorName: 'Priya Sharma',
    phone: '9876543213',
    operatingHours: { open: '06:00', close: '22:00' },
    slotDuration: 30,
    slotCapacity: 5,
    bufferMinutes: 0,
  },
  {
    name: 'CNG Fast Fill - Kukatpally',
    address: 'KPHB Colony, Kukatpally, Hyderabad, Telangana 500072',
    location: { lat: 17.4942, lng: 78.3954 },
    cngLevel: 93,
    isActive: true,
    operatorName: 'Anil Gupta',
    phone: '9876543214',
    operatingHours: { open: '00:00', close: '23:59' },
    slotDuration: 30,
    slotCapacity: 5,
    bufferMinutes: 0,
  },
];

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('[Seed] Connected to MongoDB');

    await Promise.all([
      Pump.deleteMany({}),
      Slot.deleteMany({}),
      User.deleteMany({}),
      Booking.deleteMany({}),
    ]);
    console.log('[Seed] Cleared existing data');

    const pumps = await Pump.insertMany(pumpsSeedData);
    console.log(`[Seed] Created ${pumps.length} pumps`);

    for (const pump of pumps) {
      const slotDefs = generateSlots({
        startTime: new Date(),
        hoursAhead: 12,
        slotDuration: pump.slotDuration,
        capacity: pump.slotCapacity,
      });

      const seededSlots = slotDefs.map((slot, index) => ({
        ...slot,
        pumpId: pump._id,
        booked: index < 4 ? Math.floor(Math.random() * Math.min(slot.capacity, 3)) : 0,
      }));

      await Slot.insertMany(seededSlots);
    }
    console.log('[Seed] Created slots for all pumps');

    const adminPassword = 'admin123';
    for (let i = 0; i < pumps.length; i += 1) {
      await User.create({
        name: pumpsSeedData[i].operatorName,
        phone: pumpsSeedData[i].phone,
        role: 'admin',
        password: adminPassword,
        pumpId: pumps[i]._id,
      });
    }
    console.log('[Seed] Created admin users (password: admin123)');

    console.log('[Seed] Completed.');
    process.exit(0);
  } catch (error) {
    console.error('[Seed] Error:', error);
    process.exit(1);
  }
}

seed();
