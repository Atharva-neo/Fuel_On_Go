const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeSchedule, generateSlotDefs, withinWindows, parseClock, formatClock, istNow, addDaysIso, slotInstant, SLOT_DURATION_MINUTES,
} = require('../src/services/slotSchedule');
const gen = require('../src/services/slotGenerator');

// ---- in-memory twin of the slots/bookings tables (same uniqueness + CHECK rules as the real schema) ----
class MemStore {
  constructor() { this.slots = []; this.bookings = []; this.seq = 0; }
  async listSlots(pumpId, date) {
    return this.slots.filter((s) => s.pump_id === pumpId && s.slot_date === date).map((s) => ({ ...s })).sort((a, b) => a.start_time.localeCompare(b.start_time));
  }
  async slotIdsWithBookings(ids) { return new Set(this.bookings.filter((b) => ids.includes(b.slot_id)).map((b) => b.slot_id)); }
  async insertSlots(rows) {
    for (const r of rows) {
      if (this.slots.some((s) => s.pump_id === r.pump_id && s.slot_date === r.slot_date && s.start_time === r.start_time)) continue; // UNIQUE, ignoreDuplicates
      this.slots.push({ id: `s${++this.seq}`, booked_count: 0, ...r });
    }
  }
  async deleteSlots(ids) {
    for (const id of ids) if (this.bookings.some((b) => b.slot_id === id)) throw new Error('FK violation: slot has bookings');
    this.slots = this.slots.filter((s) => !ids.includes(s.id));
  }
  async updateCapacity(id, capacity) {
    const s = this.slots.find((x) => x.id === id);
    if (s.booked_count > capacity) throw new Error('chk_booked_lte_capacity');
    s.capacity = capacity;
  }
  book(slotId, status = 'confirmed') {
    const s = this.slots.find((x) => x.id === slotId);
    s.booked_count += 1;
    this.bookings.push({ id: `b${++this.seq}`, slot_id: slotId, status, slot_date: s.slot_date, slot_start: s.start_time, slot_end: s.end_time });
  }
}

const NOW = new Date('2030-06-10T04:00:00Z'); // 09:30 IST on 2030-06-10
const TODAY = '2030-06-10';
const pump = (open, close, cap = 5) => ({ id: 'p1', working_hours_start: open, working_hours_end: close, vehicles_per_slot: cap });
const clocks = (slots) => slots.map((s) => `${String(s.start_time).slice(0, 5)}-${String(s.end_time).slice(0, 5)}`);

test('duration: one app-wide slot length (30 min), consistent with the owner slot-time editor', () => {
  assert.equal(SLOT_DURATION_MINUTES, 30);
});

test('clock parsing: 24:00 is midnight, junk is rejected', () => {
  assert.equal(parseClock('06:00'), 360);
  assert.equal(parseClock('6:05'), 365);
  assert.equal(parseClock('24:00'), 1440);
  assert.equal(parseClock('24:00:00'), 1440);
  for (const bad of ['24:01', '25:00', '12:60', '', null, undefined, 'abc', '12', '1:2']) assert.equal(parseClock(bad), null, String(bad));
  assert.equal(formatClock(1440), '24:00');
});

test('standard daytime hours 06:00-22:00 produce 30-minute slots with the configured capacity', () => {
  const s = normalizeSchedule('06:00', '22:00');
  assert.equal(s.ok, true);
  const defs = generateSlotDefs(s, 5);
  assert.equal(defs.length, 32);
  assert.equal(defs[0].start_time, '06:00:00');
  assert.equal(defs.at(-1).end_time, '22:00:00');
  assert.ok(defs.every((d) => d.endMin - d.startMin === 30 && d.capacity === 5));
});

test('late-night opening with midnight close (22:00-24:00) works, with 24:00 and 00:00 both accepted', () => {
  for (const close of ['24:00', '00:00']) {
    const s = normalizeSchedule('22:00', close);
    assert.equal(s.ok, true, close);
    assert.equal(s.close, '24:00'); // normalised convention
    assert.equal(s.overnight, false);
    const defs = generateSlotDefs(s, 5);
    assert.deepEqual(defs.map((d) => d.start_time.slice(0, 5)), ['22:00', '22:30', '23:00', '23:30']);
    assert.equal(defs.at(-1).end_time, '24:00:00');
  }
});

test('trailing time shorter than a slot is not turned into an invalid slot (no slot past closing)', () => {
  const s = normalizeSchedule('22:00', '23:45');
  const defs = generateSlotDefs(s, 5);
  assert.deepEqual(defs.map((d) => d.end_time.slice(0, 5)), ['22:30', '23:00', '23:30']);
  assert.ok(defs.every((d) => d.endMin <= s.closeMin));
});

test('overnight schedule 22:00-02:00 is supported: two windows per calendar day, no slot crosses midnight', () => {
  const s = normalizeSchedule('22:00', '02:00');
  assert.equal(s.ok, true);
  assert.equal(s.overnight, true);
  const defs = generateSlotDefs(s, 4);
  assert.deepEqual(defs.map((d) => d.start_time.slice(0, 5)), ['00:00', '00:30', '01:00', '01:30', '22:00', '22:30', '23:00', '23:30']);
  assert.ok(defs.every((d) => d.endMin > d.startMin && d.endMin <= 1440));
  assert.equal(withinWindows(s, 23 * 60 + 30, 24 * 60), true);
  assert.equal(withinWindows(s, 2 * 60, 2 * 60 + 30), false); // after closing
  assert.equal(withinWindows(s, 12 * 60, 12 * 60 + 30), false); // daytime is closed
});

test('round-the-clock 00:00-24:00 gives 48 slots', () => {
  assert.equal(generateSlotDefs(normalizeSchedule('00:00', '24:00'), 5).length, 48);
});

test('invalid, equal and unsupported schedules are rejected with clear codes', () => {
  assert.equal(normalizeSchedule('', '22:00').code, 'INVALID_TIME');
  assert.equal(normalizeSchedule('06:00', undefined).code, 'INVALID_TIME');
  assert.equal(normalizeSchedule('25:00', '22:00').code, 'INVALID_TIME');
  assert.equal(normalizeSchedule('24:00', '06:00').code, 'INVALID_OPENING');
  assert.equal(normalizeSchedule('08:00', '08:00').code, 'SAME_TIME');
  assert.equal(normalizeSchedule('00:00', '00:00').code, 'SAME_TIME');
  assert.equal(normalizeSchedule('08:00', '08:20').code, 'TOO_SHORT');
  for (const bad of [normalizeSchedule('08:00', '08:00'), normalizeSchedule('', '')]) assert.ok(bad.message.length > 20);
});

test('IST handling: the date/time come from IST even when the server clock is UTC', () => {
  // 2030-06-10 20:00 UTC is already 01:30 on 06-11 in IST
  assert.deepEqual(istNow(new Date('2030-06-10T20:00:00Z')), { date: '2030-06-11', minutes: 90 });
  assert.equal(istNow(new Date('2030-06-10T18:29:00Z')).date, '2030-06-10');
  assert.equal(addDaysIso('2030-12-31', 1), '2031-01-01');
  assert.equal(slotInstant('2030-06-10', '24:00:00').toISOString(), '2030-06-10T18:30:00.000Z'); // IST midnight of the next day
  assert.equal(slotInstant('2030-06-10', '06:00:00').toISOString(), '2030-06-10T00:30:00.000Z');
});

test('Manage Slots for hours outside the old defaults: 22:00-24:00 shows slots (the reported bug)', async () => {
  const store = new MemStore();
  const p = pump('22:00', '24:00');
  const r = await gen.getSlotsForDate({ store, pump: p, date: TODAY, now: NOW });
  assert.deepEqual(clocks(r.slots), ['22:00-22:30', '22:30-23:00', '23:00-23:30', '23:30-24:00']);
  assert.ok(r.slots.every((s) => s.capacity === 5 && s.status === 'open'));
  assert.equal(r.schedule.close, '24:00');
});

test('Today / Tomorrow / Day After each get their own correct-date slots', async () => {
  const store = new MemStore();
  const p = pump('06:00', '08:00');
  for (const [offset, date] of [[0, '2030-06-10'], [1, '2030-06-11'], [2, '2030-06-12']]) {
    assert.equal(addDaysIso(TODAY, offset), date);
    const r = await gen.getSlotsForDate({ store, pump: p, date, now: NOW });
    assert.equal(r.slots.length, 4);
    assert.ok(r.slots.every((s) => s.slot_date === date));
  }
});

test('statuses: earlier today is expired, later is open, full and deactivated are kept', async () => {
  const store = new MemStore();
  const p = pump('08:00', '12:00', 2);
  let r = await gen.getSlotsForDate({ store, pump: p, date: TODAY, now: NOW }); // now = 09:30 IST
  assert.deepEqual(r.slots.map((s) => s.status), ['expired', 'expired', 'expired', 'open', 'open', 'open', 'open', 'open']);
  const open = store.slots.find((s) => s.start_time === '10:00:00');
  store.book(open.id); store.book(open.id);
  store.slots.find((s) => s.start_time === '11:00:00').is_deactivated = true;
  r = await gen.getSlotsForDate({ store, pump: p, date: TODAY, now: NOW });
  assert.equal(r.slots.find((s) => s.start_time === '10:00:00').status, 'full');
  assert.equal(r.slots.find((s) => s.start_time === '11:00:00').status, 'deactivated');
  assert.equal(r.slots.find((s) => s.start_time === '10:00:00').available, 0);
});

test('saving the same hours repeatedly never creates duplicates; concurrent generators converge', async () => {
  const store = new MemStore();
  const p = pump('06:00', '22:00');
  await gen.ensureUpcoming({ store, pump: p, now: NOW });
  const count = store.slots.length;
  assert.equal(count, 32 * 7);
  for (let i = 0; i < 3; i++) {
    await gen.applyScheduleChange({ store, pump: p, before: p, now: NOW });
    await gen.ensureUpcoming({ store, pump: p, now: NOW });
  }
  assert.equal(store.slots.length, count);
  await Promise.all([1, 2, 3, 4].map(() => gen.ensureUpcoming({ store, pump: p, now: NOW })));
  assert.equal(store.slots.length, count);
  const keys = store.slots.map((s) => `${s.slot_date}|${s.start_time}`);
  assert.equal(new Set(keys).size, keys.length);
});

test('changing hours from the old default to 22:00-24:00 replaces slots for every upcoming day', async () => {
  const store = new MemStore();
  const before = pump('06:00', '22:00');
  await gen.ensureUpcoming({ store, pump: before, now: NOW });
  const after = pump('22:00', '24:00');
  const result = await gen.applyScheduleChange({ store, pump: after, before, now: NOW });
  assert.equal(result.hours_changed, true);
  assert.equal(result.removed, 32 * 7);
  assert.equal(result.created, 4 * 7);
  for (const d of [0, 1, 2, 3, 4, 5, 6]) {
    const r = await gen.getSlotsForDate({ store, pump: after, date: addDaysIso(TODAY, d), now: NOW });
    assert.deepEqual(clocks(r.slots), ['22:00-22:30', '22:30-23:00', '23:00-23:30', '23:30-24:00']);
  }
  assert.equal(store.slots.length, 4 * 7);
});

test('capacity-only change updates vehicles per slot without touching times, never below what is booked', async () => {
  const store = new MemStore();
  const before = pump('06:00', '08:00', 5);
  await gen.ensureUpcoming({ store, pump: before, now: NOW });
  const slot = store.slots.find((s) => s.slot_date === TODAY && s.start_time === '07:00:00');
  for (let i = 0; i < 4; i++) store.book(slot.id);
  const after = pump('06:00', '08:00', 2);
  const result = await gen.applyScheduleChange({ store, pump: after, before, now: NOW });
  assert.equal(result.hours_changed, false);
  assert.equal(result.capacity_changed, true);
  assert.equal(store.slots.find((s) => s.id === slot.id).capacity, 4); // booked 4 > new 2: not forced below bookings
  assert.ok(store.slots.filter((s) => s.id !== slot.id).every((s) => s.capacity === 2));
  assert.equal(store.slots.length, 4 * 7);
});

test('existing bookings are preserved when hours change: booked slots are neither deleted nor overlapped', async () => {
  const store = new MemStore();
  const before = pump('06:00', '22:00');
  await gen.ensureUpcoming({ store, pump: before, now: NOW });
  const booked = store.slots.find((s) => s.slot_date === TODAY && s.start_time === '10:00:00');
  store.book(booked.id);
  const cancelledOnly = store.slots.find((s) => s.slot_date === TODAY && s.start_time === '11:00:00');
  store.book(cancelledOnly.id, 'cancelled'); cancelledOnly.booked_count = 0; // history row remains, count released

  const after = pump('08:00', '14:00'); // narrower, new 08:00 grid
  const r = await gen.applyScheduleChange({ store, pump: after, before, now: NOW });
  assert.ok(r.kept >= 2);
  assert.ok(store.slots.find((s) => s.id === booked.id), 'booked slot survives');
  assert.ok(store.slots.find((s) => s.id === cancelledOnly.id), 'slot with booking history survives (FK)');
  assert.equal(store.bookings.length, 2);
  const today = (await store.listSlots('p1', TODAY)).map((s) => ({ a: parseClock(s.start_time), b: parseClock(s.end_time) })).sort((x, y) => x.a - y.a);
  for (let i = 1; i < today.length; i++) assert.ok(today[i].a >= today[i - 1].b, 'no overlapping slots');
});

test('bookings that would fall outside new hours are reported (the API refuses the change instead of cancelling them)', () => {
  const schedule = normalizeSchedule('08:00', '14:00');
  const out = gen.bookingsOutside(schedule, [
    { slot_start: '09:00:00', slot_end: '09:30:00' },
    { slot_start: '15:00:00', slot_end: '15:30:00' },
    { slot_start: '13:45:00', slot_end: '14:15:00' },
  ]);
  assert.equal(out.length, 2);
});

test('customers cannot book outside the saved hours, and see the same slots the owner sees', async () => {
  const store = new MemStore();
  const p = pump('22:00', '24:00');
  const owner = await gen.getSlotsForDate({ store, pump: p, date: TODAY, now: NOW });
  const customer = await gen.getSlotsForDate({ store, pump: p, date: TODAY, now: NOW });
  assert.deepEqual(owner.slots.map((s) => s.id), customer.slots.map((s) => s.id));
  assert.equal(gen.slotAllowedByHours(p, { start_time: '22:30:00', end_time: '23:00:00' }), true);
  assert.equal(gen.slotAllowedByHours(p, { start_time: '23:30:00', end_time: '24:00:00' }), true);
  assert.equal(gen.slotAllowedByHours(p, { start_time: '10:00:00', end_time: '10:30:00' }), false);
  assert.equal(gen.slotAllowedByHours(p, { start_time: '23:45:00', end_time: '24:15:00' }), false);
  assert.equal(gen.slotAllowedByHours({ ...p, working_hours_start: 'bad' }, { start_time: '22:30:00', end_time: '23:00:00' }), false);
});

test('slots left over from old hours are hidden from both owner and customer lists', async () => {
  const store = new MemStore();
  const old = pump('06:00', '22:00');
  await gen.getSlotsForDate({ store, pump: old, date: TODAY, now: NOW });
  const booked = store.slots.find((s) => s.start_time === '10:00:00');
  store.book(booked.id);
  const now = pump('22:00', '24:00');
  const r = await gen.getSlotsForDate({ store, pump: now, date: TODAY, now: NOW });
  assert.ok(r.slots.every((s) => parseClock(s.start_time) >= 22 * 60));
  assert.ok(!r.slots.some((s) => s.id === booked.id));
});

test('legacy 35-minute slots are healed to the current duration only when nothing on that day is booked', async () => {
  const store = new MemStore();
  const p = pump('06:00', '08:00');
  for (const [a, b] of [['06:00:00', '06:35:00'], ['06:35:00', '07:10:00'], ['07:10:00', '07:45:00']]) {
    store.slots.push({ id: `old${a}`, pump_id: 'p1', slot_date: TODAY, start_time: a, end_time: b, capacity: 5, booked_count: 0, is_deactivated: false });
  }
  let r = await gen.getSlotsForDate({ store, pump: p, date: TODAY, now: NOW });
  assert.deepEqual(clocks(r.slots), ['06:00-06:30', '06:30-07:00', '07:00-07:30', '07:30-08:00']);

  const store2 = new MemStore();
  store2.slots.push({ id: 'x1', pump_id: 'p1', slot_date: TODAY, start_time: '06:00:00', end_time: '06:35:00', capacity: 5, booked_count: 1, is_deactivated: false });
  store2.bookings.push({ id: 'bk', slot_id: 'x1', status: 'confirmed' });
  r = await gen.getSlotsForDate({ store: store2, pump: p, date: TODAY, now: NOW });
  assert.deepEqual(clocks(r.slots), ['06:00-06:35']); // booked day left untouched
});

test('a paused (deactivated) slot stays paused when the grid is rebuilt onto the same start time', async () => {
  const store = new MemStore();
  const before = pump('06:00', '08:00');
  await gen.ensureUpcoming({ store, pump: before, now: NOW });
  const s = store.slots.find((x) => x.slot_date === TODAY && x.start_time === '07:00:00');
  s.is_deactivated = true; s.deactivation_reason = 'Maintenance';
  const after = pump('06:00', '09:00');
  await gen.applyScheduleChange({ store, pump: after, before, now: NOW });
  const again = store.slots.find((x) => x.slot_date === TODAY && x.start_time === '07:00:00');
  assert.equal(again.is_deactivated, true);
  assert.equal(again.deactivation_reason, 'Maintenance');
});

test('invalid saved hours surface as an error, not as a silent empty list', async () => {
  const store = new MemStore();
  await assert.rejects(gen.getSlotsForDate({ store, pump: pump('08:00', '08:00'), date: TODAY, now: NOW }), { code: 'SAME_TIME', status: 400 });
  await assert.rejects(gen.ensureUpcoming({ store, pump: pump('', ''), now: NOW }), { code: 'INVALID_TIME' });
});

test('a failing store is reported (so the app can show an error + retry) rather than returning no slots', async () => {
  const store = new MemStore();
  store.listSlots = async () => { throw new Error('db down'); };
  await assert.rejects(gen.getSlotsForDate({ store, pump: pump('06:00', '22:00'), date: TODAY, now: NOW }), /db down/);
});

test('overnight pump: today has the early-morning window and the evening window, no duplicates across days', async () => {
  const store = new MemStore();
  const p = pump('22:00', '02:00');
  const r = await gen.getSlotsForDate({ store, pump: p, date: TODAY, now: NOW });
  assert.deepEqual(clocks(r.slots), ['00:00-00:30', '00:30-01:00', '01:00-01:30', '01:30-02:00', '22:00-22:30', '22:30-23:00', '23:00-23:30', '23:30-24:00']);
  assert.equal(r.schedule.overnight, true);
  await gen.ensureUpcoming({ store, pump: p, now: NOW });
  await gen.ensureUpcoming({ store, pump: p, now: NOW });
  assert.equal(store.slots.length, 8 * 7);
});
