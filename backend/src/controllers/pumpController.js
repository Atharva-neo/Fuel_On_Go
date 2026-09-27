const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess } = require('../utils/response');
const {
  listActivePumps,
  getPumpById,
  getPumpSlots,
  updatePumpAvailability,
} = require('../services/pumpService');
const { emitPumpUpdated } = require('../services/socketEmitter');
const db = require('../data/store');

const listPumps = asyncHandler(async (req, res) => {
  const pumps = await listActivePumps();
  return sendSuccess(res, pumps, { message: 'Pumps fetched.' });
});

const getPump = asyncHandler(async (req, res) => {
  const pump = await getPumpById(req.validated.params.id);
  return sendSuccess(res, pump, { message: 'Pump fetched.' });
});

const getSlots = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const { date } = req.validated.query || {};

  const slots = await getPumpSlots(id, date);
  return sendSuccess(res, slots, {
    message: 'Slots fetched.',
    meta: {
      slotDurationMinutes: 30,
      slotCapacity: 5,
    },
  });
});

const updateAvailability = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const pump = await updatePumpAvailability(id, req.validated.body);
  emitPumpUpdated(req.app.get('io'), pump);
  return sendSuccess(res, pump, { message: 'Pump availability updated.' });
});

// Controller to fetch nearby pumps
exports.getNearbyPumps = async (req, res) => {
  try {
    const { lat, lng, radius, north, south, east, west } = req.query;

    let query = `
      SELECT id, name, lat, lng, address, city, district, is_active
      FROM pumps
      WHERE is_active = true
    `;

    if (north && south && east && west) {
      query += `
        AND lat BETWEEN ${south} AND ${north}
        AND lng BETWEEN ${west} AND ${east}
      `;
    } else if (lat && lng && radius) {
      query += `
        AND earth_box(ll_to_earth(${lat}, ${lng}), ${radius}) @> ll_to_earth(lat, lng)
      `;
    }

    query += ' ORDER BY id LIMIT 100';

    const pumps = await db.query(query);

    res.status(200).json(pumps.rows);
  } catch (error) {
    console.error('Error fetching nearby pumps:', error);
    res.status(500).json({ error: 'Failed to fetch nearby pumps' });
  }
});

const addPumps = asyncHandler(async (req, res) => {
  const { districtName, pumpCount } = req.validated.body;
  const pumps = await addPumpsForDistrict(districtName, pumpCount);
  return sendSuccess(res, pumps, { message: `${pumpCount} pumps added for district ${districtName}.` });
});

module.exports = {
  listPumps,
  getPump,
  getSlots,
  updateAvailability,
  addPumps,
};
