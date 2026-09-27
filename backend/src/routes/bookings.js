const express = require('express');
const validateRequest = require('../middleware/validateRequest');
const bookingController = require('../controllers/bookingController');
const {
  createBookingSchema,
  bookingIdSchema,
  bookingTokenLookupSchema,
} = require('../validators/bookingValidators');

const router = express.Router();

router.post('/', validateRequest(createBookingSchema), bookingController.create);
router.get('/token/:token', validateRequest(bookingTokenLookupSchema), bookingController.getByToken);
router.get('/:id', validateRequest(bookingIdSchema), bookingController.getById);
router.delete('/:id', validateRequest(bookingIdSchema), bookingController.cancel);
router.put('/:id/checkin', validateRequest(bookingIdSchema), bookingController.checkIn);

module.exports = router;
