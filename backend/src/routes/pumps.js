const express = require('express');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const validateRequest = require('../middleware/validateRequest');
const pumpController = require('../controllers/pumpController');
const {
  pumpIdSchema,
  slotsQuerySchema,
  updateAvailabilitySchema,
} = require('../validators/pumpValidators');

const router = express.Router();

router.get('/', pumpController.listPumps);
router.get('/:id', validateRequest(pumpIdSchema), pumpController.getPump);
router.get('/:id/slots', validateRequest(slotsQuerySchema), pumpController.getSlots);
router.put(
  '/:id/availability',
  authMiddleware,
  adminOnly,
  validateRequest(updateAvailabilitySchema),
  pumpController.updateAvailability
);

module.exports = router;
