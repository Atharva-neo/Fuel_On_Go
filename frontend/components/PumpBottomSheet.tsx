'use client';

import { Pump, Slot } from '@/lib/api';

type PumpBottomSheetProps = {
  pumps: Pump[];
  selectedPump: Pump | null;
  slots: Slot[];
  selectedSlotId?: string | null;
  loadingSlots: boolean;
  onPumpSelect: (pump: Pump) => void;
  onBackToList: () => void;
  onSlotSelect: (slot: Slot) => void;
  onContinue: () => void;
};

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function statusText(level: number) {
  if (level > 50) return 'Available';
  if (level > 20) return 'Medium';
  return 'Low';
}

export default function PumpBottomSheet({
  pumps,
  selectedPump,
  slots,
  selectedSlotId,
  loadingSlots,
  onPumpSelect,
  onBackToList,
  onSlotSelect,
  onContinue,
}: PumpBottomSheetProps) {
  const visiblePumps = pumps.slice(0, 30);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fuel on Go</p>
          <p className="text-lg font-semibold text-slate-900">
            {selectedPump ? selectedPump.name : 'Nearby CNG Pumps'}
          </p>
        </div>
        {selectedPump ? (
          <button type="button" className="ghost-btn" onClick={onBackToList}>
            Change
          </button>
        ) : (
          <span className="text-xs text-slate-500">{pumps.length} found</span>
        )}
      </div>

      {selectedPump ? (
        <div className="grid gap-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-800">{selectedPump.address}</p>
            <p className="text-xs text-slate-600">
              CNG: {selectedPump.cngLevel}% ({statusText(selectedPump.cngLevel)})
            </p>
          </div>

          {loadingSlots ? (
            <p className="text-sm text-slate-500">Loading slots...</p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-slate-500">No upcoming slots available.</p>
          ) : (
            <div className="grid gap-2">
              {slots.map((slot) => {
                const isFull = slot.status === 'full';
                const isSelected = selectedSlotId === slot._id;
                return (
                  <button
                    key={slot._id}
                    type="button"
                    onClick={() => onSlotSelect(slot)}
                    disabled={isFull}
                    className={[
                      'rounded-xl border px-3 py-2 text-left text-sm',
                      isSelected
                        ? 'border-blue-400 bg-blue-50 text-blue-900'
                        : 'border-slate-200 bg-white text-slate-700',
                      isFull ? 'cursor-not-allowed opacity-60' : '',
                    ].join(' ')}
                  >
                    <p>{formatTime(slot.startTime)}</p>
                    <p className="text-xs">{isFull ? 'Full' : `${slot.available}/${slot.capacity} available`}</p>
                  </button>
                );
              })}
            </div>
          )}

          <button
            type="button"
            className="primary-btn wide"
            disabled={!selectedSlotId}
            onClick={onContinue}
          >
            Continue Booking
          </button>
        </div>
      ) : (
        <div className="grid gap-2">
          {visiblePumps.map((pump) => (
            <button
              key={pump._id}
              type="button"
              onClick={() => onPumpSelect(pump)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left"
            >
              <p className="text-sm font-semibold text-slate-800">{pump.name}</p>
              <p className="text-xs text-slate-600">
                {pump.cngLevel}% CNG - {statusText(pump.cngLevel)}
              </p>
            </button>
          ))}
          {pumps.length > visiblePumps.length && (
            <p className="text-xs text-slate-500">
              Showing {visiblePumps.length} of {pumps.length} pumps in lightweight mode.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
