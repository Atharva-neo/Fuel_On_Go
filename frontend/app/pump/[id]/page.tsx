'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { SlotGrid } from '@/components/SlotGrid';
import { BookingCard } from '@/components/BookingCard';
import { Loader2, ArrowLeft, Fuel, Info } from 'lucide-react';
import Link from 'next/link';

export default function PumpDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [pump, setPump] = useState<any>(null);
  const [slots, setSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [bookingStatus, setBookingStatus] = useState<'idle'|'booking'|'success'|'error'>('idle');
  const [bookingData, setBookingData] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadData() {
      if (!params?.id) return;
      const { data: pumpData } = await supabase.from('pumps').select('*').eq('id', params.id).single();
      const { data: slotsData } = await supabase.from('slots').select('*').eq('pump_id', params.id).order('start_time');
      
      setPump(pumpData);
      setSlots(slotsData?.filter((s) => new Date(s.start_time) > new Date()) || []);
      setLoading(false);
    }
    loadData();
  }, [params?.id]);

  const handleBook = async () => {
    if (!selectedSlot) return;
    setBookingStatus('booking');
    setErrorMessage('');

    // Simulate current user ID (in real app, get from auth)
    const { data: userData } = await supabase.from('users').select('*').limit(1).single();
    if (!userData) {
      setErrorMessage('User not found. Please login.');
      setBookingStatus('error');
      return;
    }

    if (userData.trust_score < 40) {
      setErrorMessage('Trust score too low (<40). Booking disabled.');
      setBookingStatus('error');
      return;
    }

    // Attempt booking
    // 1. Double check slot capacity
    const { data: slotCheck } = await supabase.from('slots').select('booked_count, capacity').eq('id', selectedSlot.id).single();
    if (slotCheck && slotCheck.booked_count >= slotCheck.capacity) {
      setErrorMessage('Slot is full. Please select another slot.');
      setBookingStatus('error');
      return;
    }

    // 2. Insert booking
    const token = `QR-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const { data: booking, error } = await supabase.from('bookings').insert([{
      user_id: userData.id,
      slot_id: selectedSlot.id,
      status: 'confirmed',
      qr_token: token
    }]).select().single();

    if (error) {
      setErrorMessage(error.message);
      setBookingStatus('error');
      return;
    }

    // 3. Update slot count
    await supabase.from('slots').update({ booked_count: slotCheck!.booked_count + 1 }).eq('id', selectedSlot.id);

    setBookingData(booking);
    setBookingStatus('success');
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-green-500" /></div>;
  if (!pump) return <div className="p-8 text-center text-gray-500">Pump not found</div>;

  if (bookingStatus === 'success' && bookingData) {
    return (
      <div className="p-4 space-y-6 pt-8 pb-32">
        <h2 className="text-2xl font-black text-gray-900 text-center mb-8">Booking Confirmed! 🎉</h2>
        <BookingCard 
          bookingId={bookingData.id}
          pumpName={pump.name}
          slotStartTime={selectedSlot.start_time}
          qrToken={bookingData.qr_token}
        />
        <div className="pt-8">
          <Link href="/">
            <button className="w-full py-4 font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
              Return Home
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-32 bg-gray-50 min-h-screen">
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-4 sticky top-0 z-10 shadow-sm">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-50 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="font-bold text-lg text-gray-900 truncate">Pump Details</h1>
      </div>

      <div className="p-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-6">
          <h2 className="text-2xl font-black text-gray-900 leading-tight">{pump.name}</h2>
          <p className="text-gray-500 text-sm mt-1 mb-4">{pump.address}</p>
          
          <div className="grid grid-cols-2 gap-3 pb-2 border-b border-gray-50 mb-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Density</p>
              <p className="font-bold text-gray-900 mt-1 flex items-center gap-1.5">
                <Fuel className="w-4 h-4 text-blue-500" />
                {pump.fuel_density} kg/m³
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Price</p>
              <p className="font-bold text-green-600 mt-1">₹{pump.cng_price}/kg</p>
            </div>
          </div>
          
          <div className="bg-blue-50/50 p-3 rounded-xl flex items-start gap-3 border border-blue-100">
            <Info className="w-5 h-5 text-blue-500 shrink-0" />
            <p className="text-xs text-blue-800 leading-relaxed">Arrive within 10 minutes of your slot time to avoid no-show penalties to your trust score.</p>
          </div>
        </div>

        <h3 className="font-bold text-lg text-gray-900 mb-4 flex items-center gap-2">
          Select Booking Slot
        </h3>
        
        <SlotGrid 
          slots={slots} 
          selectedSlotId={selectedSlot?.id} 
          onSelectSlot={setSelectedSlot} 
        />
      </div>

      {selectedSlot && (
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-200 p-4 shadow-[0_-10px_40px_rgb(0,0,0,0.1)] z-50">
          {errorMessage && <div className="text-red-500 text-sm mb-3 font-semibold text-center">{errorMessage}</div>}
          <button 
            onClick={handleBook}
            disabled={bookingStatus === 'booking'}
            className="w-full h-14 bg-gray-900 hover:bg-black text-white font-bold text-lg rounded-xl shadow-md transition-transform active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {bookingStatus === 'booking' ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm Booking'}
          </button>
        </div>
      )}
    </div>
  );
}
