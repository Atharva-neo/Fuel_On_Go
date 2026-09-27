'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import { supabase } from '@/lib/supabase';
import { PumpCard } from './PumpCard';

function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

export default function PumpMap() {
  const [pumps, setPumps] = useState<any[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number]>([19.0760, 72.8777]); // Default Mumbai
  const [zoom, setZoom] = useState(12);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Get user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation([pos.coords.latitude, pos.coords.longitude]);
          setZoom(13);
        },
        (err) => console.log('Geolocation error:', err)
      );
    }

    // 2. Fetch pumps from Supabase
    async function fetchPumps() {
      const { data, error } = await supabase.from('pumps').select('*').limit(50);
      if (data) {
        setPumps(data);
      }
      setLoading(false);
    }
    fetchPumps();
  }, []);

  if (loading) {
    return <div className="h-64 w-full bg-gray-100 flex items-center justify-center text-gray-500 animate-pulse rounded-xl">Loading map...</div>;
  }

  return (
    <div className="h-64 w-full rounded-xl overflow-hidden shadow-sm border border-gray-200 relative z-0">
      <MapContainer center={userLocation} zoom={zoom} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <ChangeView center={userLocation} zoom={zoom} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* User Marker */}
        <Marker position={userLocation}>
          <Popup>You are here</Popup>
        </Marker>

        {/* Pump Markers */}
        {pumps.map(pump => (
          <Marker key={pump.id} position={[pump.lat, pump.lng]}>
            <Popup className="w-64">
              <div className="font-bold text-sm mb-1">{pump.name}</div>
              <p className="text-xs text-gray-600 mb-2">{pump.address}</p>
              <div className="text-xs font-semibold text-green-600">₹{pump.cng_price}/kg</div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
