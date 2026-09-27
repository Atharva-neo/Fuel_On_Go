'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ShieldCheck, CalendarX, ShieldAlert, Award, Clock } from 'lucide-react';
import { BookingCard } from '@/components/BookingCard';

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);

  useEffect(() => {
    async function loadProfile() {
      // Fetch mock user
      const { data: userData } = await supabase.from('users').select('*').limit(1).single();
      if (userData) {
        setUser(userData);
        // Fetch their bookings
        const { data: bookingData } = await supabase.from('bookings')
          .select('*, slots(start_time, pumps(name))')
          .eq('user_id', userData.id)
          .order('created_at', { ascending: false });
        
        if (bookingData) setBookings(bookingData);
      }
    }
    loadProfile();
  }, []);

  if (!user) return <div className="p-8 text-center text-gray-500 animate-pulse">Loading Profile...</div>;

  return (
    <div className="p-4 space-y-6">
      <div className="text-center pt-6 pb-2">
        <div className="w-24 h-24 bg-gradient-to-tr from-green-400 to-emerald-300 rounded-full mx-auto flex items-center justify-center shadow-lg border-4 border-white">
          <span className="text-4xl font-black text-white">{user.name?.charAt(0) || 'U'}</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mt-4">{user.name || 'CNG User'}</h1>
        <p className="text-gray-500 font-medium mt-1">{user.vehicle_number} • {user.vehicle_type}</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Trust & Stats</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className={`p-4 rounded-xl border ${user.trust_score >= 80 ? 'bg-green-50 border-green-100' : user.trust_score >= 40 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'}`}>
            <div className="flex items-center gap-2 mb-2">
              {user.trust_score >= 80 ? <ShieldCheck className="text-green-500 w-5 h-5" /> : <ShieldAlert className="text-red-500 w-5 h-5" />}
              <span className={`text-sm font-semibold ${user.trust_score >= 80 ? 'text-green-700' : 'text-red-700'}`}>Trust Score</span>
            </div>
            <p className={`text-3xl font-black ${user.trust_score >= 80 ? 'text-green-600' : 'text-red-600'}`}>{user.trust_score}</p>
          </div>

          <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <CalendarX className="text-orange-500 w-5 h-5" />
              <span className="text-sm font-semibold text-orange-700">No-Shows</span>
            </div>
            <p className="text-3xl font-black text-orange-600">{user.no_show_count}</p>
          </div>
        </div>

        <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center gap-4">
          <div className="bg-blue-100 p-3 rounded-full shrink-0">
            <Award className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="font-bold text-blue-900 leading-tight">Time Saved</h3>
            <p className="text-sm text-blue-700 mt-0.5">You've saved approximately <span className="font-bold">4.5 hours</span> in queue wait times this month!</p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-4 px-1 flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-400" /> Recent Bookings
        </h2>
        <div className="space-y-4">
          {bookings.map(booking => (
            <BookingCard 
              key={booking.id}
              bookingId={booking.id}
              pumpName={booking.slots.pumps.name}
              slotStartTime={booking.slots.start_time}
              qrToken={booking.qr_token}
            />
          ))}
          {bookings.length === 0 && (
            <div className="text-center p-8 text-gray-400 bg-white rounded-2xl border border-gray-100">No recent bookings found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
