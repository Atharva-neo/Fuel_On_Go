// Run: npm run test:colors
// Guards the design system: colours come from src/theme tokens, not from literals in components.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../src');
const walk = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = walk(root).filter((f) => /\.tsx?$/.test(f));
const norm = (f) => f.split(path.sep).join('/');

// Documented exceptions: palette definitions and the map pages (CSS/JS inside a WebView
// that cannot read React Native tokens; they are fed the theme through CSS variables).
const ALLOWED = [
  'src/theme/palettes.ts',
  'src/theme/tokens.ts',
  'src/components/mapKit.ts',
  'src/components/homeMapHtml.ts',
  'src/components/pickerMapHtml.ts',
  'src/screens/booking/NavigationMapScreen.tsx',
];
const LITERAL = /(['"`])(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))\1/;

test('no hard-coded colour literals outside the palette files and map pages', () => {
  const offenders = [];
  for (const f of files) {
    const rel = norm(f).slice(norm(f).indexOf('src/'));
    if (ALLOWED.includes(rel)) continue;
    fs.readFileSync(f, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (/^\s*\/\//.test(line)) return;
        if (LITERAL.test(line)) offenders.push(`${rel}:${i + 1}  ${line.trim().slice(0, 90)}`);
      });
  }
  assert.deepEqual(offenders, [], '\n' + offenders.join('\n'));
});

test('the legacy competing palettes are gone', () => {
  assert.ok(!/export const Colors\b/.test(fs.readFileSync(path.join(root, 'config/theme.ts'), 'utf8')));
  assert.ok(!/export const colors\b/.test(fs.readFileSync(path.join(root, 'theme/stitch.ts'), 'utf8')));
});
