const { z } = require('zod');

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id format');

const adminLoginSchema = z.object({
  body: z.object({
    phone: z.string().trim().min(8).max(20),
    password: z.string().min(6).max(100),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const updatePumpSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    cngLevel: z.number().min(0).max(100).optional(),
    isActive: z.boolean().optional(),
    operatingHours: z.object({
      open: z.string().regex(/^\d{2}:\d{2}$/),
      close: z.string().regex(/^\d{2}:\d{2}$/),
    }).optional(),
    slotCapacity: z.number().int().min(1).max(5).optional(),
  }).refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field is required.',
  }),
  query: z.object({}).optional(),
});

const adminBookingsQuerySchema = z.object({
  params: z.object({}).optional(),
  body: z.object({}).optional(),
  query: z.object({
    status: z.enum(['confirmed', 'checked_in', 'completed', 'cancelled', 'expired']).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    page: z.coerce.number().int().min(1).optional().default(1),
  }),
});

module.exports = {
  adminLoginSchema,
  updatePumpSchema,
  adminBookingsQuerySchema,
};
