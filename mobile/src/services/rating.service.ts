import api from '../config/api';

export interface ReviewItem {
  id: string;
  rating: number;
  review: string | null;
  tags: string[];
  reviewer: string;
  verified_visit: boolean;
  created_at: string;
  edited: boolean;
  status?: 'visible' | 'hidden';
  report_status?: 'open' | 'upheld' | 'dismissed' | null;
}

export interface PumpReviews {
  pump_id: string;
  average: number | null;
  count: number;
  distribution: Record<'1' | '2' | '3' | '4' | '5', number>;
  reviews: ReviewItem[];
  has_more: boolean;
  trend?: Array<{ week_ending: string; count: number; average: number | null }>;
}

export interface Eligibility {
  eligible: boolean;
  reason: 'NOT_COMPLETED' | 'OWN_PUMP' | null;
  pump_id: string;
  rating: { id: string; rating: number; review: string | null; tags: string[]; editable: boolean } | null;
}

export interface SubmitResult {
  created: boolean;
  duplicate: boolean;
  pump: { id: string; rating_avg: number | null; rating_count: number };
  summary: { average: number | null; count: number };
}

export const ratingService = {
  async submit(p: { bookingId: string; rating: number; review: string; tags: string[] }): Promise<SubmitResult> {
    const { data } = await api.post('/ratings', {
      booking_id: p.bookingId,
      rating: p.rating,
      review: p.review.trim() || undefined,
      tags: p.tags,
    });
    return data;
  },

  async eligibility(bookingId: string): Promise<Eligibility> {
    const { data } = await api.get(`/ratings/booking/${bookingId}`);
    return data;
  },

  async pumpReviews(pumpId: string, offset = 0, limit = 20): Promise<PumpReviews> {
    const { data } = await api.get(`/ratings/pump/${pumpId}`, { params: { offset, limit } });
    return data;
  },

  async ownerFeedback(pumpId: string, offset = 0, limit = 30): Promise<PumpReviews> {
    const { data } = await api.get(`/ratings/owner/${pumpId}`, { params: { offset, limit } });
    return data;
  },

  async report(ratingId: string, reason: string) {
    const { data } = await api.post(`/ratings/${ratingId}/report`, { reason });
    return data;
  },
};
