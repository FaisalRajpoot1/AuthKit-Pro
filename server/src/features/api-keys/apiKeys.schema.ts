import { z } from 'zod';

export const createApiKeySchema = z.object({
  name: z.string().min(1, 'A name is required').max(60).trim(),
  scopes: z.array(z.string()).min(1, 'Select at least one scope'),
  expiresInDays: z.coerce.number().int().min(1).max(365).optional(),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
