const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCoords } = require('../src/utils/coords');

test('valid coordinates are returned as numbers at full precision', () => {
  assert.deepEqual(parseCoords('16.8524123456', 74.5815123456), { lat: 16.8524123456, lng: 74.5815123456 });
});

test('missing, non-numeric, boolean and out-of-range values are rejected', () => {
  for (const [a, b] of [[null, 1], [1, undefined], ['', 1], ['abc', 1], [true, 1], [91, 0], [0, 181], [-91, 10], [NaN, 1], [Infinity, 1], [0, 0]]) {
    assert.equal(parseCoords(a, b), null, `${a},${b}`);
  }
});

test('boundary values are accepted', () => {
  assert.deepEqual(parseCoords(90, 180), { lat: 90, lng: 180 });
  assert.deepEqual(parseCoords(-90, -180), { lat: -90, lng: -180 });
});
