// Trust Score policy. Every number here is configurable; the scoring rules
// live in one place so routes, cron and tests never hard-code them.
//
// Env overrides (all optional):
//   TRUST_DEFAULT_SCORE            default 80
//   TRUST_NO_SHOW_PENALTY          default 15   (points deducted)
//   TRUST_NO_SHOW_GRACE_MINUTES    default 15   (after slot start)
//   TRUST_CANCELLATION_TIERS       JSON, e.g. [{"minHours":24,"exclusive":true,"penalty":0}, ...]

const DEFAULT_TIERS = [
  // evaluated top to bottom; first match wins. `exclusive` => hours > minHours.
  { minHours: 24, exclusive: true, penalty: 0, label: 'More than 24 hours before' },
  { minHours: 6, exclusive: false, penalty: 2, label: '6 to 24 hours before' },
  { minHours: 1, exclusive: false, penalty: 5, label: '1 to 6 hours before' },
  { minHours: -Infinity, exclusive: false, penalty: 8, label: 'Less than 1 hour before' },
];

const BANDS = [
  { min: 90, label: 'Excellent', key: 'excellent' },
  { min: 75, label: 'Good', key: 'good' },
  { min: 50, label: 'Fair', key: 'fair' },
  { min: 25, label: 'Low', key: 'low' },
  { min: 0, label: 'Very Low', key: 'very_low' },
];

function num(value, fallback) {
  const n = Number(value);
  return value !== undefined && value !== '' && Number.isFinite(n) ? n : fallback;
}

function parseTiers(raw) {
  if (!raw) return DEFAULT_TIERS;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return DEFAULT_TIERS;
    const tiers = parsed.map((t) => ({
      minHours: t.minHours === null || t.minHours === undefined ? -Infinity : Number(t.minHours),
      exclusive: !!t.exclusive,
      penalty: Math.abs(Number(t.penalty) || 0),
      label: t.label || '',
    }));
    return tiers;
  } catch {
    return DEFAULT_TIERS;
  }
}

function buildPolicy(env = process.env) {
  return {
    defaultScore: clamp(num(env.TRUST_DEFAULT_SCORE, 80)),
    noShowPenalty: Math.abs(num(env.TRUST_NO_SHOW_PENALTY, 15)),
    noShowGraceMinutes: Math.max(0, num(env.TRUST_NO_SHOW_GRACE_MINUTES, 15)),
    cancellationTiers: parseTiers(env.TRUST_CANCELLATION_TIERS),
    bands: BANDS,
  };
}

function clamp(score) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreBand(score, policy = defaultPolicy) {
  const s = clamp(Number(score) || 0);
  return policy.bands.find((b) => s >= b.min);
}

// hoursUntilSlot may be negative (slot already started).
function cancellationPenalty(hoursUntilSlot, policy = defaultPolicy) {
  const h = Number(hoursUntilSlot);
  const safe = Number.isFinite(h) ? h : -Infinity;
  for (const tier of policy.cancellationTiers) {
    const hit = tier.exclusive ? safe > tier.minHours : safe >= tier.minHours;
    if (hit) return { penalty: tier.penalty, label: tier.label };
  }
  const last = policy.cancellationTiers[policy.cancellationTiers.length - 1];
  return { penalty: last.penalty, label: last.label };
}

const defaultPolicy = buildPolicy();

module.exports = { buildPolicy, defaultPolicy, scoreBand, cancellationPenalty, clamp, BANDS };
