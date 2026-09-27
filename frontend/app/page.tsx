'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { PumpCard } from '@/components/PumpCard';
import { supabase } from '@/lib/supabase';
import { Sparkles, Loader2 } from 'lucide-react';

const PumpMap = dynamic(() => import('@/components/PumpMap'), { 
  ssr: false, 
  loading: () => <div className="h-64 w-full bg-gray-100 flex items-center justify-center animate-pulse rounded-xl"><Loader2 className="w-6 h-6 text-gray-400 animate-spin" /></div> 
});

export default function Home() {
  const [pumps, setPumps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPumps() {
      const { data } = await supabase.from('pumps').select('*').limit(10);
      if (data) setPumps(data);
      setLoading(false);
    }
    loadPumps();
  }, []);

  return (
    <div className="p-4 space-y-6">
      <section>
        <h2 className="text-xl font-extrabold text-gray-900 mb-3 tracking-tight">Nearby CNG Pumps</h2>
        <PumpMap />
      </section>

      <section className="bg-gradient-to-r from-emerald-50 to-teal-50 p-4 rounded-xl border border-emerald-100 shadow-sm relative overflow-hidden">
        <div className="absolute -right-4 -top-4 opacity-10">
          <Sparkles className="w-24 h-24 text-emerald-600" />
        </div>
        <h3 className="font-bold text-emerald-800 flex items-center gap-2 relative z-10">
          <Sparkles className="w-5 h-5" /> 
          AI Recommended
        </h3>
        <p className="text-xs text-emerald-700/80 mt-1 relative z-10">Based on distance and wait time</p>
        
        <div className="mt-4 relative z-10">
          {!loading && pumps.length > 0 ? (
            <PumpCard 
              id={pumps[0].id} 
              name={pumps[0].name} 
              address={pumps[0].address} 
              distance="1.2 km away"
              fuelDensity={pumps[0].fuel_density}
              cngPrice={pumps[0].cng_price}
              bestChoice={true} 
            />
          ) : (
            <div className="animate-pulse bg-white/50 h-32 rounded-xl"></div>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-4 px-1">All Available Pumps</h2>
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-gray-400 w-8 h-8" /></div>
          ) : (
            pumps.slice(1).map(pump => (
              <PumpCard 
                key={pump.id}
                id={pump.id} 
                name={pump.name} 
                address={pump.address} 
                fuelDensity={pump.fuel_density}
                cngPrice={pump.cng_price}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
