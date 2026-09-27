const { z } = require('zod');

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id format');

const createBookingSchema = z.object({
  body: z.object({
    slotId: objectIdSchema,
    pumpId: objectIdSchema,
    userName: z.string().trim().min(2).max(80),
    phone: z.string().trim().regex(/^[0-9+\-()\s]{8,20}$/, 'Invalid phone number'),
    vehicleNumber: z.string().trim().toUpperCase().min(4).max(20),
    vehicleType: z.enum(['Car', 'Auto', 'Bus', 'Other']).optional().default('Car'),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const bookingIdSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  query: z.object({}).optional(),
  body: z.object({}).optional(),
});

const bookingTokenLookupSchema = z.object({
  params: z.object({
    token: z.string().trim().min(2).max(32),
  }),
  query: z.object({
    phone: z.string().trim().regex(/^[0-9+\-()\s]{8,20}$/, 'Invalid phone number').optional(),
    slotId: objectIdSchema.optional(),
  }),
  body: z.object({}).optional(),
});

module.exports = {
  createBookingSchema,
  bookingIdSchema,
  bookingTokenLookupSchema,
};
