const { z } = require('zod');

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id format');

const pumpIdSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  query: z.object({}).optional(),
  body: z.object({}).optional(),
});

const slotsQuerySchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  query: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
  body: z.object({}).optional(),
});

const updateAvailabilitySchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    cngLevel: z.number().min(0).max(100).optional(),
    isActive: z.boolean().optional(),
  }).refine((v) => v.cngLevel !== undefined || v.isActive !== undefined, {
    message: 'At least one field is required.',
  }),
  query: z.object({}).optional(),
});

module.exports = {
  pumpIdSchema,
  slotsQuerySchema,
  updateAvailabilitySchema,
};
