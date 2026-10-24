// Run: npm run test:i18n
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { flatten, makeTranslator, diffDicts, parseLanguage, LANGUAGES } from '../src/i18n/core.ts';
import { formatRupees, formatDate, formatClock, formatNumber } from '../src/i18n/format.ts';
import { createLangStore, DEVICE_KEY, userKey } from '../src/i18n/langStoreCore.ts';
import en from '../src/i18n/locales/en.ts';
import hi from '../src/i18n/locales/hi.ts';
import mr from '../src/i18n/locales/mr.ts';

const dicts = { en: flatten(en), hi: flatten(hi), mr: flatten(mr) };
const DEVANAGARI = /[ऀ-ॿ]/;

test('three languages are offered, each named in its own script', () => {
  assert.deepEqual(LANGUAGES.map((l) => l.code), ['en', 'hi', 'mr']);
  assert.equal(LANGUAGES[1].native, 'हिन्दी');
  assert.equal(LANGUAGES[2].native, 'मराठी');
  assert.equal(parseLanguage('mr'), 'mr');
  assert.equal(parseLanguage('fr'), null);
});

test('Hindi and Marathi have exactly the same keys and placeholders as English', () => {
  for (const code of ['hi', 'mr']) {
    const d = diffDicts(dicts.en, dicts[code]);
    assert.deepEqual(d.missing, [], `${code} missing keys`);
    assert.deepEqual(d.extra, [], `${code} extra keys`);
    assert.deepEqual(d.placeholderMismatch, [], `${code} placeholder mismatch`);
  }
});

test('no empty translations; Hindi and Marathi are in Devanagari, not transliterated English', () => {
  // Strings that are legitimately Latin-only or symbols in every language.
  const ALLOWED_LATIN = new Set(['status.pending', 'status.all']);
  for (const code of ['en', 'hi', 'mr']) {
    for (const [k, v] of Object.entries(dicts[code])) assert.ok(v.trim().length > 0, `${code}:${k} empty`);
  }
  for (const code of ['hi', 'mr']) {
    const offenders = Object.entries(dicts[code])
      .filter(([k, v]) => !DEVANAGARI.test(v) && !ALLOWED_LATIN.has(k))
      // only digits, placeholders, punctuation and brand tokens (UPI, CNG, QR, OTP) are acceptable
      .filter(([, v]) => v.replace(/\{\{\s*\w+\s*\}\}/g, '').replace(/[0-9\s:.,()/+\-~#%@*_]/g, '').replace(/\b(UPI|CNG|QR|OTP|GPS|PIN|km|m)\b/g, '').trim().length > 0)
      .map(([k]) => k);
    assert.deepEqual(offenders, [], `${code} has untranslated values`);
  }
});

test('plural keys exist in pairs for every language', () => {
  for (const code of ['en', 'hi', 'mr']) {
    const keys = Object.keys(dicts[code]);
    for (const k of keys.filter((x) => x.endsWith('_one'))) assert.ok(keys.includes(k.replace(/_one$/, '_other')), `${code}:${k} lacks _other`);
    for (const k of keys.filter((x) => x.endsWith('_other'))) assert.ok(keys.includes(k.replace(/_other$/, '_one')), `${code}:${k} lacks _one`);
  }
});

test('interpolation, plurals, fallback to English and safe unknown keys', () => {
  const missing = [];
  const t = makeTranslator(dicts, 'hi', (k, l) => missing.push(`${l}:${k}`));
  assert.equal(t('home.slots', { count: 1 }), '1 स्लॉट');
  assert.equal(t('rating.reviewCount', { count: 1 }), '1 समीक्षा');
  assert.equal(t('rating.reviewCount', { count: 3 }), '3 समीक्षाएँ');
  const tm = makeTranslator(dicts, 'mr');
  assert.equal(tm('home.pumpsNearby', { count: 5 }), '5 CNG पंप जवळ');
  assert.equal(tm('auth.welcomeBack', { name: 'आदित्य' }), 'पुन्हा स्वागत, आदित्य!');
  const te = makeTranslator(dicts, 'en');
  assert.equal(te('home.pumpsNearby', { count: 1 }), '1 CNG pump nearby');
  assert.equal(te('home.pumpsNearby', { count: 2 }), '2 CNG pumps nearby');
  // unknown key never throws and stays visible; the miss is reported
  assert.equal(t('does.not.exist'), 'does.not.exist');
  assert.ok(missing.includes('hi:does.not.exist'));
  // a key missing from the active language falls back to English
  const partial = { ...dicts, mr: { ...dicts.mr } };
  delete partial.mr['common.ok'];
  assert.equal(makeTranslator(partial, 'mr')('common.ok'), 'OK');
  // user-entered values are never altered (pump names, addresses)
  assert.equal(t('rating.ratePump', { pump: 'Ghanshyampump' }), 'Ghanshyampump को रेट करें');
});

test('every status the app can show has a label in every language', () => {
  for (const k of ['pending_approval', 'pending', 'confirmed', 'arrived', 'completed', 'no_show', 'cancelled', 'rejected', 'expired', 'unknown']) {
    for (const code of ['en', 'hi', 'mr']) assert.ok(dicts[code][`status.${k}`], `${code}:status.${k}`);
  }
  for (const k of ['upcoming', 'completed', 'cancelled']) for (const code of ['en', 'hi', 'mr']) assert.ok(dicts[code][`booking.${k}`]);
});

test('every backend error code the client knows has a localized message', () => {
  const src = fs.readFileSync(path.resolve(import.meta.dirname, '../src/i18n/errors.ts'), 'utf8');
  const block = src.slice(src.indexOf('new Set(['), src.indexOf(']);'));
  const codes = [...block.matchAll(/'([A-Z_]{4,})'/g)].map((m) => m[1]);
  assert.ok(codes.length > 20);
  for (const c of codes) for (const code of ['en', 'hi', 'mr']) assert.ok(dicts[code][`apiError.${c}`], `${code}:apiError.${c}`);
});

test('formatting changes the display only: Indian grouping, rupee sign, dates, 12-hour clock', () => {
  assert.equal(formatRupees(1234567.5, 'en'), '₹12,34,567.50');
  assert.equal(formatRupees(50, 'hi', 0), '₹50');
  assert.equal(formatNumber(1234567, 'mr'), '12,34,567');
  assert.equal(formatDate('2026-10-24', 'en'), '24 Oct 2026');
  assert.match(formatDate('2026-10-24', 'hi'), /2026/);
  assert.match(formatClock('18:15:00', 'en'), /6:15\s?pm/i);
  assert.match(formatClock('24:00', 'en'), /12:00\s?am/i); // midnight close
  // underlying values are untouched
  assert.equal(formatDate('not-a-date', 'en'), 'not-a-date');
});

function memoryStorage() {
  const m = new Map();
  return { m, getItem: async (k) => (m.has(k) ? m.get(k) : null), setItem: async (k, v) => void m.set(k, v) };
}
const tick = () => new Promise((r) => setTimeout(r, 5));

test('language persists across restarts and is per account on a shared device', async () => {
  const storage = memoryStorage();
  const a = createLangStore(storage);
  await a.getState().hydrate();
  assert.equal(a.getState().language, 'en'); // sensible default
  // chosen before login (welcome screen)
  a.getState().setLanguage('hi');
  await tick();
  assert.equal(storage.m.get(DEVICE_KEY), 'hi');

  // user 1 signs in and picks Marathi
  await a.getState().setUser('u1');
  assert.equal(a.getState().language, 'hi'); // inherits the device choice
  a.getState().setLanguage('mr');
  await tick();
  assert.equal(storage.m.get(userKey('u1')), 'mr');
  assert.equal(storage.m.get(DEVICE_KEY), 'hi'); // a signed-in choice does not rewrite the device default

  // user 2 on the same phone is unaffected by user 1
  await a.getState().setUser('u2');
  assert.equal(a.getState().language, 'hi');
  a.getState().setLanguage('en');
  await tick();
  await a.getState().setUser('u1');
  assert.equal(a.getState().language, 'mr');

  // app restart: a new store over the same storage restores the choice
  const b = createLangStore(storage);
  await b.getState().hydrate();
  await b.getState().setUser('u1');
  assert.equal(b.getState().language, 'mr');
  await b.getState().setUser('u2');
  assert.equal(b.getState().language, 'en');
  // logout returns to the device default
  await b.getState().setUser(null);
  assert.equal(b.getState().language, 'hi');
});

test('corrupt or unreadable storage never breaks startup', async () => {
  const bad = { getItem: async () => { throw new Error('boom'); }, setItem: async () => { throw new Error('boom'); } };
  const s = createLangStore(bad);
  await s.getState().hydrate();
  assert.equal(s.getState().language, 'en');
  s.getState().setLanguage('mr'); // does not throw
  assert.equal(s.getState().language, 'mr');
  const junk = createLangStore({ getItem: async () => 'klingon', setItem: async () => {} });
  await junk.getState().hydrate();
  assert.equal(junk.getState().language, 'en');
});

test('screens use translation keys, not literal English UI text', () => {
  const root = path.resolve(import.meta.dirname, '../src');
  const live = [
    'screens/WelcomeScreen.tsx', 'screens/UserAuthScreen.tsx', 'screens/AdminAuthScreen.tsx', 'screens/OTPScreen.tsx', 'screens/RegistrationScreen.tsx',
    'screens/home/HomeScreen.tsx', 'screens/pump/PumpDetailScreen.tsx', 'screens/pump/PumpReviewsScreen.tsx',
    'screens/booking/BookingDetailScreen.tsx', 'screens/booking/BookingSuccessScreen.tsx', 'screens/booking/MyBookingsScreen.tsx',
    'screens/booking/PaymentScreen.tsx', 'screens/booking/NavigationMapScreen.tsx', 'screens/profile/ProfileScreen.tsx',
    'screens/profile/EditProfileScreen.tsx', 'screens/auth/LocationSetupScreen.tsx',
    'screens/admin/AdminDashboardScreen.tsx', 'screens/admin/AdminBookingsScreen.tsx', 'screens/admin/AdminBookingDetailScreen.tsx',
    'screens/admin/OwnerFeedbackScreen.tsx', 'screens/admin/QRScannerScreen.tsx', 'screens/admin/SlotManagementScreen.tsx',
    'screens/admin/AddPumpScreen.tsx', 'screens/admin/CNGUpdateScreen.tsx',
    'components/PumpLocationPicker.tsx', 'components/RateSheet.tsx', 'components/BookingRateAction.tsx', 'components/ReviewParts.tsx',
    'components/SlotCarousel.tsx', 'components/MapView.tsx', 'components/OverflowMenu.tsx', 'components/DropdownSelect.tsx', 'components/LanguageSelector.tsx',
    'navigation/RootNavigator.tsx', 'navigation/AdminNavigator.tsx',
  ];
  const offenders = [];
  for (const f of live) {
    const src = fs.readFileSync(path.join(root, f), 'utf8');
    const code = src.slice(0, src.indexOf('StyleSheet.create') > 0 ? src.indexOf('StyleSheet.create') : src.length);
    // <Text>Some English words</Text> and Alert.alert('English ...')
    for (const m of code.matchAll(/>\s*([A-Z][a-z]+(?:[ ,'&-][A-Za-z']+)*[.!?]?)\s*</g)) offenders.push(`${f}: text "${m[1]}"`);
    for (const m of code.matchAll(/Alert\.alert\(\s*(['"`])([A-Z][^'"`]{2,})\1/g)) offenders.push(`${f}: alert "${m[2]}"`);
    for (const m of code.matchAll(/(?:placeholder|accessibilityLabel|accessibilityHint)=(["'])([A-Za-z][A-Za-z ,.'-]{3,})\1/g)) offenders.push(`${f}: attr "${m[2]}"`);
  }
  assert.deepEqual(offenders, []);
});
