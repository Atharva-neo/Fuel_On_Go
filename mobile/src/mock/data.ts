// ============================================================
// MOCK DATA — Phase 1 only. No API calls. No Supabase.
// Replace with real service calls in Phase 3.
// ============================================================

export const MOCK_USER = {
  id: 'user-1',
  name: 'Prashant Patil',
  phone: '+919876543210',
  vehicle_number: 'MH09AB1234',
  vehicle_type: 'car' as const,
  trust_score: 100,
  is_blocked: false,
  no_show_count: 0,
  role: 'user' as 'user' | 'pump_owner' | 'admin',
};

export interface MockPump {
  id: string;
  name: string;
  address: string;
  city: string;
  district: string;
  lat: number;
  lng: number;
  working_hours_start: string;
  working_hours_end: string;
  cng_price_per_kg: number;
  fuel_density: number;
  vehicles_per_slot: number;
  is_active: boolean;
  available_slots_today: number;
  status: 'high' | 'medium' | 'low';
  rating: number;
}

export const MOCK_PUMPS: MockPump[] = [
  // ── KOLHAPUR ─────────────────────────────────────────────
  {
    id: 'pump-1',
    name: 'HP CNG Kolhapur Central',
    address: 'Station Road, Kolhapur',
    city: 'Kolhapur',
    district: 'Kolhapur',
    lat: 16.7028, lng: 74.2317,
    working_hours_start: '06:00', working_hours_end: '22:00',
    cng_price_per_kg: 89.50, fuel_density: 0.76,
    vehicles_per_slot: 5, is_active: true,
    available_slots_today: 18, status: 'high', rating: 4.3,
  },
  {
    id: 'pump-2',
    name: 'Bharat CNG Kolhapur Tarabai',
    address: 'Tarabai Park, Kolhapur',
    city: 'Kolhapur',
    district: 'Kolhapur',
    lat: 16.7200, lng: 74.2450,
    working_hours_start: '06:00', working_hours_end: '22:00',
    cng_price_per_kg: 88.00, fuel_density: 0.75,
    vehicles_per_slot: 5, is_active: true,
    available_slots_today: 4, status: 'medium', rating: 4.0,
  },
  // ── PUNE ─────────────────────────────────────────────────
  {
    id: 'pump-3',
    name: 'IndianOil CNG Pune Kothrud',
    address: 'Karve Road, Kothrud, Pune',
    city: 'Pune',
    district: 'Pune',
    lat: 18.5070, lng: 73.8077,
    working_hours_start: '06:00', working_hours_end: '22:00',
    cng_price_per_kg: 91.20, fuel_density: 0.77,
    vehicles_per_slot: 5, is_active: true,
    available_slots_today: 22, status: 'high', rating: 4.5,
  },
  {
    id: 'pump-4',
    name: 'HP CNG Pune Hinjewadi',
    address: 'Hinjewadi IT Park Road, Pune',
    city: 'Pune',
    district: 'Pune',
    lat: 18.5913, lng: 73.7387,
    working_hours_start: '06:00', working_hours_end: '23:00',
    cng_price_per_kg: 91.50, fuel_density: 0.75,
    vehicles_per_slot: 5, is_active: true,
    available_slots_today: 0, status: 'low', rating: 3.8,
  },
  // ── MUMBAI ───────────────────────────────────────────────
  {
    id: 'pump-5',
    name: 'MGL CNG Andheri East',
    address: 'MIDC Road, Andheri East, Mumbai',
    city: 'Mumbai',
    district: 'Mumbai',
    lat: 19.1136, lng: 72.8697,
    working_hours_start: '05:00', working_hours_end: '23:00',
    cng_price_per_kg: 94.00, fuel_density: 0.76,
    vehicles_per_slot: 5, is_active: true,
    available_slots_today: 12, status: 'high', rating: 4.2,
  },
  {
    id: 'pump-6',
    name: 'Bharat CNG Thane West',
    address: 'Pokhran Road No 1, Thane West',
    city: 'Thane',
    district: 'Thane',
    lat: 19.2094, lng: 72.9711,
    working_hours_start: '06:00', working_hours_end: '22:00',
    cng_price_per_kg: 93.50, fuel_density: 0.74,
    vehicles_per_slot: 5, is_active: true,
    available_slots_today: 3, status: 'medium', rating: 3.9,
  },
  // ── NAGPUR ───────────────────────────────────────────────
  {
    id: 'pump-7',
    name: 'CNG Nagpur Sitabuldi',
    address: 'Central Avenue, Sitabuldi, Nagpur',
    city: 'Nagpur',
    district: 'Nagpur',
    lat: 21.1458, lng: 79.0882,
    working_hours_start: '06:00', working_hours_end: '22:00',
    cng_price_per_kg: 86.00, fuel_density: 0.76,
    vehicles_per_slot: 5, is_active: true,
    available_slots_today: 16, status: 'high', rating: 4.4,
  },
  // ── NASHIK ───────────────────────────────────────────────
  {
    id: 'pump-8',
    name: 'HP CNG Nashik Road',
    address: 'Nashik Road, Nashik',
    city: 'Nashik',
    district: 'Nashik',
    lat: 19.9975, lng: 73.7898,
    working_hours_start: '06:00', working_hours_end: '22:00',
    cng_price_per_kg: 88.50, fuel_density: 0.75,
    vehicles_per_slot: 5, is_active: true,
    available_slots_today: 9, status: 'high', rating: 4.1,
  },
  // ── AURANGABAD ───────────────────────────────────────────
  {
    id: 'pump-9',
    name: 'IndianOil CNG Aurangabad City',
    address: 'Jalna Road, Aurangabad',
    city: 'Aurangabad',
    district: 'Aurangabad',
    lat: 19.8762, lng: 75.3433,
    working_hours_start: '06:00', working_hours_end: '22:00',
    cng_price_per_kg: 87.50, fuel_density: 0.75,
    vehicles_per_slot: 5, is_active: true,
    available_slots_today: 14, status: 'high', rating: 4.0,
  },
  // ── SOLAPUR ──────────────────────────────────────────────
  {
    id: 'pump-10',
    name: 'CNG Solapur Station',
    address: 'Railway Station Road, Solapur',
    city: 'Solapur',
    district: 'Solapur',
    lat: 17.6805, lng: 75.9064,
    working_hours_start: '06:00', working_hours_end: '22:00',
    cng_price_per_kg: 87.00, fuel_density: 0.73,
    vehicles_per_slot: 5, is_active: true,
    available_slots_today: 2, status: 'medium', rating: 3.7,
  },
  // ── SANGLI ───────────────────────────────────────────────
  {
    id: 'pump-11',
    name: 'Bharat CNG Sangli Vishrambag',
    address: 'Vishrambag, Sangli',
    city: 'Sangli',
    district: 'Sangli',
    lat: 16.8524, lng: 74.5815,
    working_hours_start: '06:00', working_hours_end: '22:00',
    cng_price_per_kg: 88.00, fuel_density: 0.75,
    vehicles_per_slot: 5, is_active: true,
    available_slots_today: 11, status: 'high', rating: 4.2,
  },
  // ── SATARA ───────────────────────────────────────────────
  {
    id: 'pump-12',
    name: 'HP CNG Satara City',
    address: 'Shivaji Chowk, Satara',
    city: 'Satara',
    district: 'Satara',
    lat: 17.6868, lng: 73.9945,
    working_hours_start: '06:00', working_hours_end: '21:00',
    cng_price_per_kg: 88.00, fuel_density: 0.75,
    vehicles_per_slot: 4, is_active: true,
    available_slots_today: 7, status: 'medium', rating: 3.9,
  },
  // ── NANDED ───────────────────────────────────────────────
  {
    id: 'pump-13',
    name: 'CNG Nanded Gurudwara Road',
    address: 'Gurudwara Road, Nanded',
    city: 'Nanded',
    district: 'Nanded',
    lat: 19.1383, lng: 77.3210,
    working_hours_start: '06:00', working_hours_end: '22:00',
    cng_price_per_kg: 86.50, fuel_density: 0.74,
    vehicles_per_slot: 5, is_active: true,
    available_slots_today: 13, status: 'high', rating: 4.0,
  },
  // ── LATUR ────────────────────────────────────────────────
  {
    id: 'pump-14',
    name: 'IndianOil CNG Latur',
    address: 'Main Road, Latur',
    city: 'Latur',
    district: 'Latur',
    lat: 18.4088, lng: 76.5604,
    working_hours_start: '06:00', working_hours_end: '22:00',
    cng_price_per_kg: 86.00, fuel_density: 0.74,
    vehicles_per_slot: 5, is_active: true,
    available_slots_today: 8, status: 'medium', rating: 3.8,
  },
];

export interface MockSlot {
  id: string;
  pump_id: string;
  start_time: string;  // "HH:mm"
  end_time: string;    // "HH:mm"
  booked_count: number;
  capacity: number;
  available: number;
  status: 'open' | 'full' | 'expired' | 'deactivated';
  deactivation_reason: string | null;
  is_user_booked: boolean;
  period: 'morning' | 'afternoon' | 'evening';
}

// Get current IST time
function nowIST(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
}

// Convert a slot time string (HH:mm) on a given date offset to IST Date
function slotToIST(hour: number, minute: number, dateOffsetDays: number): Date {
  const istNow = nowIST();
  const slotDate = new Date(istNow);
  slotDate.setDate(slotDate.getDate() + dateOffsetDays);
  slotDate.setHours(hour, minute, 0, 0);
  return slotDate;
}

export function generateMockSlots(pumpId: string, _date?: string, dateOffsetDays: number = 0): MockSlot[] {
  const slots: MockSlot[] = [];
  let hour = 6;
  let minute = 0;
  const now = nowIST();

  for (let i = 0; i < 27; i++) {
    if (hour >= 22) break;

    const slotTime = slotToIST(hour, minute, dateOffsetDays);
    // Only mark past if it's today AND the slot time has passed in IST
    const isPast = dateOffsetDays === 0 && slotTime < now;

    const isDeactivated = i === 8 || i === 9;
    const isFull = !isPast && !isDeactivated && Math.random() < 0.2;
    const bookedCount = isPast
      ? 5
      : isDeactivated
      ? 2
      : isFull
      ? 5
      : Math.floor(Math.random() * 4);
    const capacity = 5;
    const available = isPast || isFull ? 0 : capacity - bookedCount;

    const startStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    const endMin = (minute + 30) % 60;
    const endHour = minute + 30 >= 60 ? hour + 1 : hour;
    const endStr = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;

    let period: 'morning' | 'afternoon' | 'evening';
    if (hour < 12) period = 'morning';
    else if (hour < 18) period = 'afternoon';
    else period = 'evening';

    slots.push({
      id: `slot-${pumpId}-${i}`,
      pump_id: pumpId,
      start_time: startStr,
      end_time: endStr,
      booked_count: bookedCount,
      capacity,
      available,
      status: isPast
        ? 'expired'
        : isDeactivated
        ? 'deactivated'
        : isFull
        ? 'full'
        : 'open',
      deactivation_reason: isDeactivated
        ? 'CNG supply interrupted — truck arriving at 11:30 AM'
        : null,
      is_user_booked: i === 5,
      period,
    });

    // Advance 35 minutes
    minute += 35;
    if (minute >= 60) {
      hour++;
      minute -= 60;
    }
  }

  return slots;
}

export interface MockBooking {
  id: string;
  pump_name: string;
  pump_address: string;
  pump_lat: number;
  pump_lng: number;
  slot_start: string;
  slot_end: string;
  slot_date: string;
  status: 'confirmed' | 'arrived' | 'no_show' | 'cancelled';
  qr_token: string;
  booking_fee: number;
  total_estimated: number;
  amount_paid_now: number;
  pending_amount: number;
  fuel_payment_method: 'cash' | 'upi' | 'decided_later';
  payment_option: 'partial' | 'full';
  created_at: string;
}

const todayStr = new Date().toISOString().split('T')[0];

export const MOCK_BOOKINGS: MockBooking[] = [
  {
    id: 'booking-1',
    pump_name: 'HP CNG Kolhapur Central',
    pump_address: 'Station Road, Kolhapur',
    pump_lat: 16.7028,
    pump_lng: 74.2317,
    slot_start: '09:30',
    slot_end: '10:00',
    slot_date: todayStr,
    status: 'confirmed',
    qr_token: 'QR-ABC123XYZ',
    booking_fee: 45,
    total_estimated: 450,
    amount_paid_now: 45,
    pending_amount: 405,
    fuel_payment_method: 'cash',
    payment_option: 'partial',
    created_at: new Date().toISOString(),
  },
];

// City search suggestions for LocationSetupScreen
export const MOCK_CITIES = [
  { id: 'city-1', name: 'Kolhapur', state: 'Maharashtra', lat: 16.7050, lng: 74.2433 },
  { id: 'city-2', name: 'Pune', state: 'Maharashtra', lat: 18.5204, lng: 73.8567 },
  { id: 'city-3', name: 'Mumbai', state: 'Maharashtra', lat: 19.0760, lng: 72.8777 },
  { id: 'city-4', name: 'Nagpur', state: 'Maharashtra', lat: 21.1458, lng: 79.0882 },
  { id: 'city-5', name: 'Nashik', state: 'Maharashtra', lat: 19.9975, lng: 73.7898 },
  { id: 'city-6', name: 'Aurangabad', state: 'Maharashtra', lat: 19.8762, lng: 75.3433 },
  { id: 'city-7', name: 'Solapur', state: 'Maharashtra', lat: 17.6805, lng: 75.9064 },
  { id: 'city-8', name: 'Thane', state: 'Maharashtra', lat: 19.2183, lng: 72.9780 },
  { id: 'city-9', name: 'Sangli', state: 'Maharashtra', lat: 16.8524, lng: 74.5815 },
  { id: 'city-10', name: 'Satara', state: 'Maharashtra', lat: 17.6868, lng: 73.9945 },
  { id: 'city-11', name: 'Nanded', state: 'Maharashtra', lat: 19.1383, lng: 77.3210 },
  { id: 'city-12', name: 'Latur', state: 'Maharashtra', lat: 18.4088, lng: 76.5604 },
  { id: 'city-13', name: 'Amravati', state: 'Maharashtra', lat: 20.9320, lng: 77.7523 },
  { id: 'city-14', name: 'Akola', state: 'Maharashtra', lat: 20.7002, lng: 77.0082 },
  { id: 'city-15', name: 'Jalgaon', state: 'Maharashtra', lat: 21.0077, lng: 75.5626 },
];

// Mock admin pump stats
export const MOCK_ADMIN_STATS = {
  total_slots: 27,
  booked_slots: 12,
  arrived_count: 8,
  no_show_count: 2,
  booking_fee_collected: 240,
  pending_collection: 1800,
};
