import { format } from 'date-fns';

interface Slot {
  id: string;
  start_time: string;
  end_time: string;
  capacity: number;
  booked_count: number;
}

interface SlotGridProps {
  slots: Slot[];
  selectedSlotId?: string;
  onSelectSlot: (slot: Slot) => void;
}

export function SlotGrid({ slots, selectedSlotId, onSelectSlot }: SlotGridProps) {
  if (!slots.length) {
    return <div className="text-center py-6 text-gray-400">No slots available for today.</div>;
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {slots.map(slot => {
        const isFull = slot.booked_count >= slot.capacity;
        const isSelected = selectedSlotId === slot.id;
        const availability = slot.capacity - slot.booked_count;
        
        let stateStyles = 'bg-white border-gray-200 text-gray-700 hover:border-gray-300';
        if (isFull) stateStyles = 'bg-gray-50 border-gray-200 text-gray-400 opacity-60 cursor-not-allowed';
        else if (isSelected) stateStyles = 'bg-gray-900 border-gray-900 text-white shadow-md shadow-gray-200';
        
        return (
          <button
            key={slot.id}
            disabled={isFull}
            onClick={() => onSelectSlot(slot)}
            className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200 relative ${stateStyles}`}
          >
            <span className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-gray-900'}`}>{format(new Date(slot.start_time), 'hh:mm a')}</span>
            <span className={`text-[10px] mt-1 uppercase font-bold tracking-wider ${isFull ? 'text-gray-400' : isSelected ? 'text-gray-300' : availability <= 2 ? 'text-amber-500' : 'text-green-500'}`}>
              {isFull ? 'Full' : `${availability} LEFT`}
            </span>
            
            {isSelected && (
              <div className="absolute top-1 right-1 w-2 h-2 bg-green-400 rounded-full border border-gray-900" />
            )}
          </button>
        );
      })}
    </div>
  );
}
