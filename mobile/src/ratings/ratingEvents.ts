import { create } from 'zustand';

// Bumped after a rating is confirmed by the backend. Screens that show a pump's
// rating (home list, pump detail, reviews, my bookings) refetch when it changes,
// so a stale average is never kept on screen after a successful submission.
interface RatingEvents {
  version: number;
  lastPumpId: string | null;
  bump: (pumpId?: string | null) => void;
}

export const useRatingEvents = create<RatingEvents>((set) => ({
  version: 0,
  lastPumpId: null,
  bump: (pumpId = null) => set((s) => ({ version: s.version + 1, lastPumpId: pumpId })),
}));
