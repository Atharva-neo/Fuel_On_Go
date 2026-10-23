// Run: npm run test:schedule
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { normalizeSchedule, parseClock, istDate, slotStartMs, groupSlotsByPeriod, PERIODS, SLOT_DURATION_MINUTES } from '../src/utils/schedule.ts';

const require = createRequire(import.meta.url);
const server = require('../../backend/src/services/slotSchedule.js');

const CASES = [
  ['06:00', '22:00'], ['22:00', '24:00'], ['22:00', '00:00'], ['22:00', '02:00'], ['00:00', '24:00'], ['00:00', '00:00'],
  ['08:00', '08:00'], ['08:00', '08:20'], ['', '22:00'], ['06:00', ''], ['25:00', '22:00'], ['24:00', '06:00'], ['6:00', '9:30'],
  [null, undefined], ['abc', 'def'], ['23:30', '24:00'], ['23:45', '24:00'], ['10:00', '09:00'],
];

test('the app and the server validate and normalise hours identically (same table of inputs)', () => {
  assert.equal(SLOT_DURATION_MINUTES, server.SLOT_DURATION_MINUTES);
  for (const [o, c] of CASES) {
    const a = normalizeSchedule(o, c);
    const b = server.normalizeSchedule(o, c);
    assert.equal(a.ok, b.ok, `${o}-${c}`);
    if (a.ok) {
      assert.equal(a.open, b.open, `${o}-${c} open`);
      assert.equal(a.close, b.close, `${o}-${c} close`);
      assert.equal(a.overnight, b.overnight, `${o}-${c} overnight`);
      assert.deepEqual(a.windows, b.windows, `${o}-${c} windows`);
    } else {
      assert.equal(a.code, b.code, `${o}-${c} code`);
      assert.equal(a.message, b.message, `${o}-${c} message`);
    }
  }
  for (const v of ['06:00', '24:00', '24:01', '1:05', '', null, 'x']) assert.equal(parseClock(v), server.parseClock(v), String(v));
});

test('owner entering 22:00 to 24:00 (the reported case) is valid and saved as 22:00-24:00', () => {
  const s = normalizeSchedule('22:00', '24:00');
  assert.equal(s.ok, true);
  assert.deepEqual([s.open, s.close, s.overnight], ['22:00', '24:00', false]);
  assert.equal(normalizeSchedule('22:00', '00:00').close, '24:00'); // "00:00" closing = midnight
});

test('Today / Tomorrow / Day After are computed in IST, not UTC', () => {
  const lateNightUtc = new Date('2030-06-10T20:00:00Z'); // already 11 Jun 01:30 in India
  assert.equal(istDate(0, lateNightUtc), '2030-06-11');
  assert.equal(istDate(1, lateNightUtc), '2030-06-12');
  assert.equal(istDate(2, lateNightUtc), '2030-06-13');
  assert.equal(istDate(0, new Date('2030-06-10T18:29:00Z')), '2030-06-10');
  assert.equal(istDate(1, new Date('2030-12-31T10:00:00Z')), '2031-01-01');
  assert.equal(istDate(0, new Date('2030-06-10T18:31:00Z')), server.istNow(new Date('2030-06-10T18:31:00Z')).date);
});

test('slot start instants understand IST and 24:00', () => {
  assert.equal(new Date(slotStartMs('2030-06-10', '06:00:00')).toISOString(), '2030-06-10T00:30:00.000Z');
  assert.equal(new Date(slotStartMs('2030-06-10', '24:00:00')).toISOString(), '2030-06-10T18:30:00.000Z');
  assert.ok(Number.isNaN(slotStartMs('2030-06-10', 'bad')));
});

test('customer slot list covers every hour: no slot (e.g. 22:30, 23:30, 02:00) is dropped by a hard-coded 6AM-10PM window', () => {
  const times = ['00:00:00', '02:00:00', '05:30:00', '06:00:00', '11:30:00', '12:00:00', '17:30:00', '18:00:00', '21:30:00', '22:00:00', '22:30:00', '23:30:00'];
  const slots = times.map((t) => ({ start_time: t }));
  const groups = groupSlotsByPeriod(slots);
  assert.equal(groups.reduce((n, g) => n + g.data.length, 0), slots.length);
  assert.deepEqual(groups.find((g) => g.key === 'night').data.map((s) => s.start_time), ['22:00:00', '22:30:00', '23:30:00']);
  assert.deepEqual(groups.find((g) => g.key === 'late_night').data.map((s) => s.start_time), ['00:00:00', '02:00:00', '05:30:00']);
  assert.equal(PERIODS[0].from, 0);
  assert.equal(PERIODS.at(-1).to, 24);
});

test('periods tile the whole day without gaps or overlaps', () => {
  for (let i = 1; i < PERIODS.length; i++) assert.equal(PERIODS[i].from, PERIODS[i - 1].to);
});
