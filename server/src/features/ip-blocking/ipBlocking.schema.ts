import { z } from 'zod';

/**
 * Body for blocking an IP. `expiresAt` (ISO 8601) is optional — omit it for a
 * permanent block. When present it must be in the future.
 */
export const blockIpSchema = z.object({
  ipAddress: z.string().ip({ message: 'Must be a valid IPv4 or IPv6 address' }),
  reason: z.string().max(200).trim().optional(),
  expiresAt: z
    .string()
    .datetime({ message: 'expiresAt must be an ISO 8601 timestamp' })
    .refine((value) => new Date(value).getTime() > Date.now(), 'expiresAt must be in the future')
    .optional(),
});

export type BlockIpInput = z.infer<typeof blockIpSchema>;
