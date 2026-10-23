// Supabase-backed trust store. The score change + ledger row happen inside the
// apply_trust_event() Postgres function (migration 007), i.e. one transaction.
const { TrustError } = require('./trustScoreService');

const KNOWN = {
  USER_NOT_FOUND: [404, 'User not found'],
  EVENT_NOT_FOUND: [404, 'Trust event not found'],
  ALREADY_REVERSED: [409, 'This event was already reversed'],
  CANNOT_REVERSE_A_REVERSAL: [400, 'A reversal cannot be reversed'],
  BOOKING_ALREADY_RESOLVED: [409, 'This booking was already cancelled or marked no-show'],
};

function mapError(error) {
  const msg = error?.message || '';
  for (const code of Object.keys(KNOWN)) {
    if (msg.includes(code)) return new TrustError(KNOWN[code][0], code, KNOWN[code][1]);
  }
  if (/apply_trust_event|trust_score_events/i.test(msg) && /does not exist|schema cache/i.test(msg)) {
    return new TrustError(503, 'TRUST_NOT_MIGRATED', 'Trust score tables are not installed (run migration 007)');
  }
  return error;
}

function createSupabaseTrustStore(supabase) {
  return {
    async applyEvent(p) {
      const { data, error } = await supabase.rpc('apply_trust_event', {
        p_user_id: p.userId,
        p_booking_id: p.bookingId || null,
        p_event_type: p.eventType,
        p_delta: p.delta,
        p_idempotency_key: p.idempotencyKey,
        p_reason: p.reason || null,
        p_actor_id: p.actorId || null,
        p_reversal_of: p.reversalOf || null,
        p_metadata: p.metadata || {},
      });
      if (error) throw mapError(error);
      return data;
    },
    async getEvent(id) {
      const { data, error } = await supabase.from('trust_score_events').select('*').eq('id', id).maybeSingle();
      if (error) throw mapError(error);
      return data;
    },
    async listEvents(userId, limit) {
      const { data, error } = await supabase
        .from('trust_score_events')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw mapError(error);
      return data || [];
    },
    async getUser(userId) {
      const { data, error } = await supabase
        .from('users')
        .select('trust_score, no_show_count')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  };
}

module.exports = { createSupabaseTrustStore };
