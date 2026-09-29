import api from '../config/api';

export interface Slot {
  id: string;
  pump_id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  capacity: number;
  booked_count: number;
  is_deactivated: boolean;
  deactivation_reason?: string | null;
  status?: 'open' | 'full' | 'deactivated' | 'expired';
  available?: number;
}

export const slotService = {
  async getSlots(pumpId: string, date?: string): Promise<Slot[]> {
    const params: Record<string, string> = {};
    if (date) params.date = date;
    const { data } = await api.get(`/slots/${pumpId}`, { params });
    return data;
  },

  async deactivateSlot(slotId: string, reason?: string, resumeTime?: string) {
    const { data } = await api.patch(`/slots/${slotId}/deactivate`, {
      reason,
      resume_time: resumeTime,
    });
    return data;
  },

  async activateSlot(slotId: string) {
    const { data } = await api.patch(`/slots/${slotId}/activate`);
    return data;
  },

  async updateCapacity(slotId: string, capacity: number) {
    const { data } = await api.patch(`/slots/${slotId}/capacity`, { capacity });
    return data;
  },

  async updateTime(slotId: string, startTime: string) {
    const { data } = await api.patch(`/slots/${slotId}/time`, {
      start_time: startTime,
    });
    return data;
  },

  async bulkDeactivate(payload: {
    pump_id: string;
    from_time: string;
    to_time: string;
    reason: string;
    date?: string;
  }) {
    const { data } = await api.post('/slots/bulk-deactivate', payload);
    return data;
  },
};
