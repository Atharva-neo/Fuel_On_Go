// Server-side validation for owner-selected pump coordinates. The client's
// claim of "GPS" or "verified" is never trusted; only the numbers are checked.
function parseCoords(lat, lng) {
  const blank = (v) => v === null || v === undefined || v === '' || typeof v === 'boolean';
  if (blank(lat) || blank(lng)) return null;
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (Math.abs(a) > 90 || Math.abs(b) > 180) return null;
  if (a === 0 && b === 0) return null; // placeholder, not a real pump site
  return { lat: a, lng: b };
}

module.exports = { parseCoords };
