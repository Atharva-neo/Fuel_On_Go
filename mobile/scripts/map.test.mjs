// Run: npm run test:map
import test from 'node:test';
import assert from 'node:assert/strict';
import { MAP_TILES, MAP_USER_AGENT, mapThemeVars, cssVarsBlock, mapBootJs } from '../src/components/mapKit.ts';
import { pickerMapHtml } from '../src/components/pickerMapHtml.ts';
import { homeMapHtml } from '../src/components/homeMapHtml.ts';
import { mochaTheme, latteTheme } from '../src/theme/tokens.ts';
import { shouldStackLocationActions } from '../src/location/pumpLocation.ts';

test('regression: map no longer uses Esri World_Street_Map (grey "Map data not yet available" at zoom >= 18)', () => {
  for (const t of [mochaTheme, latteTheme]) {
    for (const html of [pickerMapHtml(t), homeMapHtml(t)]) {
      assert.ok(!/arcgisonline/i.test(html), 'Esri tile URL must be gone');
      assert.ok(html.includes('tile.openstreetmap.org/{z}/{x}/{y}.png') || process.env.EXPO_PUBLIC_MAP_TILE_URL);
    }
  }
  assert.equal(MAP_TILES.maxZoom, 19);
});

test('attribution is part of every map page and uses the OSM copyright link', () => {
  assert.ok(MAP_TILES.attribution.includes('OpenStreetMap'));
  assert.ok(pickerMapHtml(mochaTheme).includes('attribution'));
  assert.ok(homeMapHtml(latteTheme).includes('attribution'));
});

test('app-identifying user agent is set (OSM blocks anonymous browser UAs)', () => {
  assert.match(MAP_USER_AGENT, /^FuelOnGoApp\//);
});

test('map pages are themed through CSS variables that differ between Mocha and Latte', () => {
  const m = mapThemeVars(mochaTheme), l = mapThemeVars(latteTheme);
  assert.deepEqual(Object.keys(m).sort(), Object.keys(l).sort());
  for (const key of ['--map-bg', '--control-bg', '--popup-bg', '--attr-bg', '--marker-user']) assert.notEqual(m[key], l[key], key);
  assert.equal(m['--marker-pump'], '#00C896');
  assert.equal(l['--marker-pump'], '#00C896');
  assert.notEqual(m['--tile-filter'], 'none'); // dark map = inverted tiles
  assert.equal(l['--tile-filter'], 'none');
  assert.ok(cssVarsBlock(mochaTheme).includes('--map-bg'));
});

test('theme can be swapped live without rebuilding the page (applyTheme + THEME message)', () => {
  assert.ok(mapBootJs({ center: [0, 0], zoom: 3 }).includes('window.applyTheme'));
  assert.ok(pickerMapHtml(mochaTheme).includes("d.type === 'THEME'"));
  assert.ok(homeMapHtml(mochaTheme).includes("d.type === 'THEME'"));
});

test('tile failures are surfaced to the app, with a retry hook', () => {
  const boot = mapBootJs({ center: [0, 0], zoom: 3 });
  assert.ok(boot.includes('TILES_FAILED') && boot.includes('TILES_LOADED') && boot.includes('window.retryTiles'));
  assert.ok(pickerMapHtml(latteTheme).includes("d.type === 'RETRY_TILES'"));
});

test('picker pin is inside the map container (cannot leak outside the map box) and is the only pin system', () => {
  const html = pickerMapHtml(mochaTheme);
  assert.match(html, /<div id="map"><div id="dot"><\/div><div id="pin">/);
  assert.ok(!html.includes('L.marker(') && !html.includes('draggable'));
  assert.ok(html.includes("type: 'SETTLED'"));
});

test('location actions never share a row on phone widths (labels cannot overlap)', () => {
  for (const w of [320, 360, 375, 393, 412, 430, 480, 500]) assert.equal(shouldStackLocationActions(w), true, `${w}`);
  assert.equal(shouldStackLocationActions(768), false);
  assert.equal(shouldStackLocationActions(1024), false);
});
