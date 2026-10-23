import api from '../config/api';

export interface TrustEvent {
  id: string;
  event_type: 'cancellation' | 'no_show' | 'dispute_reversal';
  booking_id: string | null;
  delta: number;
  score_after: number;
  reason: string | null;
  created_at: string;
  reversed: boolean;
}

export interface TrustSummary {
  score: number;
  label: string;
  band: 'excellent' | 'good' | 'fair' | 'low' | 'very_low';
  no_show_count: number;
  history_available: boolean;
  recent_events: TrustEvent[];
}

export const trustService = {
  async getMine(limit = 5): Promise<TrustSummary> {
    const { data } = await api.get('/trust/me', { params: { limit } });
    return data;
  },
};
