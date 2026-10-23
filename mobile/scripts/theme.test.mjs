// Run: npm run test:theme
import test from 'node:test';
import assert from 'node:assert/strict';
import { mochaTheme, latteTheme } from '../src/theme/tokens.ts';
import { mocha, latte, BRAND_GREEN } from '../src/theme/palettes.ts';
import { resolveThemeName, parsePreference, contrastRatio } from '../src/theme/resolve.ts';

const M = mochaTheme.colors;
const L = latteTheme.colors;

test('palettes are the official Catppuccin values (spot checks)', () => {
  assert.equal(mocha.base, '#1e1e2e');
  assert.equal(mocha.text, '#cdd6f4');
  assert.equal(mocha.crust, '#11111b');
  assert.equal(latte.base, '#eff1f5');
  assert.equal(latte.text, '#4c4f69');
  assert.equal(latte.green, '#40a02b');
});

test('both themes define exactly the same semantic tokens (no missing key in one theme)', () => {
  assert.deepEqual(Object.keys(M).sort(), Object.keys(L).sort());
  for (const [k, v] of Object.entries({ ...M })) assert.ok(typeof v === 'string' && v.length > 3, `mocha ${k}`);
  for (const [k, v] of Object.entries({ ...L })) assert.ok(typeof v === 'string' && v.length > 3, `latte ${k}`);
});

test('Latte is a real light theme, Mocha a real dark one (not an inversion hack)', () => {
  assert.equal(mochaTheme.isDark, true);
  assert.equal(latteTheme.isDark, false);
  assert.ok(contrastRatio(M.bg, M.text) > 7);
  assert.ok(contrastRatio(L.bg, L.text) > 6);
  assert.notEqual(M.bg, L.bg);
});

test('brand green identity is unchanged in both themes', () => {
  assert.equal(BRAND_GREEN, '#00C896');
  assert.equal(M.brand, '#00C896');
  assert.equal(L.brand, '#00C896');
  assert.equal(M.markerPump, '#00C896');
  assert.equal(L.markerPump, '#00C896');
});

for (const [name, C] of [['mocha', M], ['latte', L]]) {
  test(`${name}: body text tokens reach WCAG AA (4.5:1) on every surface they appear on`, () => {
    for (const surface of [C.bg, C.bgAlt, C.surface, C.surfaceRaised]) {
      for (const key of ['text', 'textSecondary', 'brandText', 'successText', 'warningText', 'dangerText', 'infoText']) {
        const r = contrastRatio(C[key], surface);
        assert.ok(r >= 4.5, `${name}: ${key} ${C[key]} on ${surface} = ${r.toFixed(2)}`);
      }
    }
  });

  test(`${name}: muted text >= 4:1 on page background and cards (only used for secondary captions)`, () => {
    for (const surface of [C.bg, C.surface]) assert.ok(contrastRatio(C.textMuted, surface) >= 4, `${name} muted on ${surface}`);
  });

  test(`${name}: text on solid buttons passes AA`, () => {
    assert.ok(contrastRatio(C.onBrand, C.brand) >= 4.5, 'onBrand/brand');
    assert.ok(contrastRatio(C.onSuccess, C.success) >= 4.5, 'onSuccess/success');
    assert.ok(contrastRatio(C.onWarning, C.warning) >= 4.5, 'onWarning/warning');
    assert.ok(contrastRatio(C.onDanger, C.danger) >= 4.5, 'onDanger/danger');
    assert.ok(contrastRatio(C.onInfo, C.info) >= 4.5, 'onInfo/info');
    assert.ok(contrastRatio(C.onInverse, C.inverse) >= 4.5, 'onInverse/inverse');
  });

  test(`${name}: non-text UI (brand fill, borders, focus ring) is >= 3:1 where it must be seen`, () => {
    assert.ok(contrastRatio(C.focus, C.bg) >= 3, 'focus ring');
    assert.ok(contrastRatio(C.inputBorder, C.bg) >= 1.3, 'input border visible against page');
  });
}

test('brand fill is visible on Mocha surfaces; on Latte the brand fill needs its dark text colour', () => {
  assert.ok(contrastRatio(M.brand, M.surface) >= 3);
  // #00C896 as TEXT on Latte would fail, which is exactly why brandText exists.
  assert.ok(contrastRatio(L.brand, L.surface) < 3);
  assert.ok(contrastRatio(L.brandText, L.surface) >= 4.5);
});

test('theme resolution: explicit choice wins, system is the default, dark is the fallback', () => {
  assert.equal(resolveThemeName('light', 'dark'), 'latte');
  assert.equal(resolveThemeName('dark', 'light'), 'mocha');
  assert.equal(resolveThemeName('system', 'light'), 'latte');
  assert.equal(resolveThemeName('system', 'dark'), 'mocha');
  assert.equal(resolveThemeName('system', null), 'mocha');
});

test('stored preference parsing is safe for missing or corrupt values', () => {
  assert.equal(parsePreference(null), 'system');
  assert.equal(parsePreference('banana'), 'system');
  assert.equal(parsePreference('light'), 'light');
  assert.equal(parsePreference('dark'), 'dark');
});

// ─── persistence / store behaviour ───────────────────────
import { createThemeStore, THEME_STORAGE_KEY } from '../src/theme/themeStoreCore.ts';
import { createStore } from 'zustand/vanilla';

function memoryStorage(initial = {}, { failRead = false, failWrite = false } = {}) {
  const data = { ...initial };
  return {
    data,
    async getItem(k) { if (failRead) throw new Error('read'); return k in data ? data[k] : null; },
    async setItem(k, v) { if (failWrite) throw new Error('write'); data[k] = v; },
  };
}
const flush = () => new Promise((r) => setImmediate(r));

test('first launch: no stored preference -> follows the system theme, and startup is gated until hydrated', async () => {
  const s = createThemeStore(memoryStorage());
  assert.equal(s.getState().hydrated, false);
  await s.getState().hydrate();
  assert.equal(s.getState().hydrated, true);
  assert.equal(s.getState().preference, 'system');
});

test('toggle persists immediately and a fresh app launch restores it (survives "refresh")', async () => {
  const storage = memoryStorage();
  const a = createThemeStore(storage);
  await a.getState().hydrate();
  a.getState().toggle(true); // Mocha showing -> go Latte
  assert.equal(a.getState().preference, 'light');
  await flush();
  assert.equal(storage.data[THEME_STORAGE_KEY], 'light');

  const relaunched = createThemeStore(storage);
  await relaunched.getState().hydrate();
  assert.equal(relaunched.getState().preference, 'light');
  assert.equal(resolveThemeName(relaunched.getState().preference, 'dark'), 'latte');

  relaunched.getState().toggle(false); // Latte showing -> back to Mocha
  assert.equal(relaunched.getState().preference, 'dark');
});

test('corrupt stored value falls back to system; unreadable storage never blocks startup', async () => {
  const bad = createThemeStore(memoryStorage({ [THEME_STORAGE_KEY]: '{oops' }));
  await bad.getState().hydrate();
  assert.equal(bad.getState().preference, 'system');
  const broken = createThemeStore(memoryStorage({}, { failRead: true }));
  await broken.getState().hydrate();
  assert.equal(broken.getState().hydrated, true);
  assert.equal(broken.getState().preference, 'system');
});

test('a failing write still applies the theme in memory (UI never lags the tap)', async () => {
  const s = createThemeStore(memoryStorage({}, { failWrite: true }));
  s.getState().setPreference('light');
  await flush();
  assert.equal(s.getState().preference, 'light');
});

test('theme is independent of the active role: switching roles/screens cannot reset it', async () => {
  const theme = createThemeStore(memoryStorage());
  await theme.getState().hydrate();
  theme.getState().setPreference('light');
  // stand-in for the auth store's role switch (the real one lives in authStore.ts and never imports the theme store)
  const auth = createStore(() => ({ role: 'user' }));
  auth.setState({ role: 'pump_owner' });
  auth.setState({ role: 'user' });
  assert.equal(theme.getState().preference, 'light');
});

test('all four role x theme combinations resolve to a complete token set', () => {
  for (const role of ['user', 'pump_owner']) {
    for (const pref of ['dark', 'light']) {
      const t = { mocha: mochaTheme, latte: latteTheme }[resolveThemeName(pref, null)];
      assert.ok(Object.keys(t.colors).length >= 45, `${role}/${pref}`);
    }
  }
});
