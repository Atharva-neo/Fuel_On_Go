import React from 'react';
import { Navigation } from 'lucide-react';
import Link from 'next/link';

interface PumpCardProps {
  id: string;
  name: string;
  address: string;
  distance?: string;
  fuelDensity?: number;
  cngPrice?: number;
  bestChoice?: boolean;
}

export function PumpCard({ id, name, address, distance, fuelDensity, cngPrice, bestChoice }: PumpCardProps) {
  return (
    <div className={`p-4 rounded-2xl transition-all duration-300 relative bg-white border ${bestChoice ? 'border-green-400 shadow-[0_4px_20px_-4px_rgba(74,222,128,0.3)] scale-[1.01]' : 'border-gray-100 shadow-sm hover:shadow-md'}`}>
      
      {bestChoice && (
        <div className="absolute -top-3 left-4 bg-gradient-to-r from-green-500 to-emerald-400 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm flex items-center gap-1">
          <span>✨ Best Choice</span>
        </div>
      )}

      <div className="flex justify-between items-start mt-1">
        <div>
          <h3 className="font-bold text-lg text-gray-900 leading-tight">{name}</h3>
          <p className="text-sm text-gray-500 mt-1 line-clamp-1">{address}</p>
        </div>
        
        {distance && (
          <div className="bg-gray-50 text-gray-600 px-2 py-1 rounded-lg text-xs font-semibold shrink-0">
            {distance}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="bg-blue-50/50 p-2.5 rounded-xl border border-blue-50">
          <p className="text-xs text-blue-600/80 font-medium tracking-wide">Density</p>
          <p className="text-sm font-bold text-blue-700 mt-0.5">{fuelDensity ? `${fuelDensity} kg/m³` : 'N/A'}</p>
        </div>
        <div className="bg-green-50/50 p-2.5 rounded-xl border border-green-50">
          <p className="text-xs text-green-600/80 font-medium tracking-wide">Price</p>
          <p className="text-sm font-bold text-green-700 mt-0.5">{cngPrice ? `₹${cngPrice}/kg` : 'N/A'}</p>
        </div>
      </div>

      <div className="flex gap-2 mt-4 pt-4 border-t border-gray-50">
        <button className="h-10 w-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors shrink-0" title="Navigate">
          <Navigation size={18} />
        </button>
        <Link href={`/pump/${id}`} className="flex-1">
          <button className="w-full h-10 bg-gray-900 hover:bg-black text-white font-semibold rounded-xl transition-colors shadow-sm">
            Book Slot
          </button>
        </Link>
      </div>
    </div>
  );
}
