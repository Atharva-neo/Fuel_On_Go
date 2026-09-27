'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Phone, KeyRound, Loader2, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length < 10) return;
    setLoading(true);
    setTimeout(() => {
      setStep(2);
      setLoading(false);
    }, 800);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp !== '123456') {
      alert('Invalid OTP. Use 123456 for DEV MODE.');
      return;
    }
    
    setLoading(true);
    
    try {
      // Dev mode: create or get user automatically
      const mockPhone = '+91' + phone.slice(-10);
      let { data: user } = await supabase.from('users').select('*').eq('phone', mockPhone).single();
      
      if (!user) {
        const { data: newUser, error } = await supabase.from('users').insert([{
          phone: mockPhone,
          name: 'Demo User',
          vehicle_number: 'MH02AB1234',
          vehicle_type: 'Car',
          trust_score: 100
        }]).select().single();
        if (error) throw error;
        user = newUser;
      }

      router.push('/');
    } catch (err) {
      console.error(err);
      alert('Error during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-60px)] flex flex-col items-center justify-center p-6 bg-white">
      <div className="w-full max-w-sm space-y-8">
        
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 text-green-600">
            <Sparkles className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Fuel on Go</h1>
          <p className="text-gray-500 mt-2 text-sm font-medium">Smart AI Queue & Slot Booking</p>
        </div>

        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm p-4 rounded-xl text-center font-medium shadow-sm">
          DEV MODE: Use OTP <span className="font-bold bg-amber-200 px-2 py-0.5 rounded ml-1 tracking-widest text-amber-900">123456</span>
        </div>

        {step === 1 ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input 
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter Phone Number"
                className="w-full h-14 pl-12 pr-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all text-lg font-medium"
                required
              />
            </div>
            
            <button 
              type="submit"
              disabled={loading || phone.length < 10}
              className="w-full h-14 bg-gray-900 hover:bg-black text-white font-bold rounded-xl transition-all disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Continue'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="relative">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input 
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter 6-digit OTP"
                className="w-full h-14 pl-12 pr-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all text-lg font-medium tracking-widest"
                required
              />
            </div>
            
            <button 
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full h-14 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition-all shadow-md shadow-green-200 disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify & Login'}
            </button>
            
            <button 
              type="button"
              onClick={() => setStep(1)}
              className="w-full text-center text-sm text-gray-500 font-semibold hover:text-gray-900 transition-colors"
            >
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
