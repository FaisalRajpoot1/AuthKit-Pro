import { z } from 'zod';

/** Query params for paginating a user's audit history. */
export const auditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().uuid().optional(),
});

export type AuditQuery = z.infer<typeof auditQuerySchema>;
