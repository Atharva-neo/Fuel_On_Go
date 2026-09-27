const express = require('express');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const validateRequest = require('../middleware/validateRequest');
const adminController = require('../controllers/adminController');
const {
  adminLoginSchema,
  updatePumpSchema,
  adminBookingsQuerySchema,
} = require('../validators/adminValidators');

const router = express.Router();

router.post('/login', validateRequest(adminLoginSchema), adminController.login);
router.get('/dashboard', authMiddleware, adminOnly, adminController.dashboard);
router.put(
  '/pumps/:id',
  authMiddleware,
  adminOnly,
  validateRequest(updatePumpSchema),
  adminController.updatePump
);
router.get(
  '/bookings',
  authMiddleware,
  adminOnly,
  validateRequest(adminBookingsQuerySchema),
  adminController.bookings
);

module.exports = router;
