'use client';

import { QRCodeSVG } from 'qrcode.react';
import { format, differenceInMinutes, addMinutes } from 'date-fns';
import { useState, useEffect } from 'react';
import { CheckCircle2, Ticket, Clock, Ban } from 'lucide-react';

interface BookingCardProps {
  bookingId: string;
  pumpName: string;
  slotStartTime: string;
  qrToken?: string;
  onCancel?: () => void;
}

export function BookingCard({ bookingId, pumpName, slotStartTime, qrToken, onCancel }: BookingCardProps) {
  const [timeLeft, setTimeLeft] = useState<number>(10);
  const startTime = new Date(slotStartTime);

  useEffect(() => {
    // Waitlist/No show mechanics simulation
    const interval = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 60000); // decrement every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-gray-100 overflow-hidden relative">
      <div className="bg-gray-900 px-6 py-4 flex justify-between items-center text-white">
        <h3 className="font-bold flex items-center gap-2">
          <Ticket className="w-5 h-5 text-emerald-400" />
          Confirmed Booking
        </h3>
        <span className="text-xs font-semibold bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full border border-emerald-500/30">
          ID: {bookingId.slice(0, 8).toUpperCase()}
        </span>
      </div>

      <div className="p-6">
        <div className="text-center mb-6">
          <h4 className="font-bold text-xl text-gray-900">{pumpName}</h4>
          <p className="text-gray-500 text-sm mt-1">Slot: {format(startTime, 'hh:mm a')} - {format(addMinutes(startTime, 30), 'hh:mm a')}</p>
          <p className="text-gray-500 text-xs">{format(startTime, 'MMM do, yyyy')}</p>
        </div>

        <div className="flex justify-center mb-6">
          <div className="p-4 bg-white rounded-2xl shadow-inner border border-gray-100 border-dashed">
            {qrToken ? (
              <QRCodeSVG value={qrToken} size={160} level="H" className="opacity-90" />
            ) : (
              <div className="w-40 h-40 bg-gray-100 flex items-center justify-center rounded-xl text-gray-400">No QR</div>
            )}
          </div>
        </div>

        <div className="bg-amber-50 rounded-xl p-4 flex items-start gap-3 border border-amber-100 mb-6">
          <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Check-in Required</p>
            <p className="text-xs text-amber-700/80 mt-1">You must present this QR code at the pump within {timeLeft} minutes to avoid a trust score penalty.</p>
          </div>
        </div>

        {onCancel && (
          <button 
            onClick={onCancel}
            className="w-full h-12 flex items-center justify-center gap-2 text-red-500 font-bold bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
          >
            <Ban className="w-4 h-4" /> Cancel Booking
          </button>
        )}
      </div>
    </div>
  );
}
