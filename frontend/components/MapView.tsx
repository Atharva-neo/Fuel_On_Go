'use client';

import type { Pump } from '@/lib/api';

type MapViewProps = {
  pumps: Pump[];
  selectedPumpId?: string | null;
  onPumpSelect: (pump: Pump) => void;
};

export default function MapView({ pumps, selectedPumpId, onPumpSelect }: MapViewProps) {
  const visiblePumps = pumps.slice(0, 30);

  if (pumps.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
        Map view is disabled in lightweight mode.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-700">Pump List (Map Placeholder)</p>
      <div className="mt-3 grid gap-2">
        {visiblePumps.map((pump) => {
          const isSelected = selectedPumpId === pump._id;
          return (
            <button
              key={pump._id}
              type="button"
              onClick={() => onPumpSelect(pump)}
              className={[
                'rounded-xl border px-3 py-2 text-left text-sm',
                isSelected
                  ? 'border-blue-400 bg-blue-50 text-blue-900'
                  : 'border-slate-200 bg-slate-50 text-slate-700',
              ].join(' ')}
            >
              <p className="font-semibold">{pump.name}</p>
              <p className="text-xs">{pump.address}</p>
            </button>
          );
        })}
      </div>
      {pumps.length > visiblePumps.length && (
        <p className="mt-3 text-xs text-slate-500">
          Showing {visiblePumps.length} of {pumps.length} pumps in lightweight mode.
        </p>
      )}
    </div>
  );
}
