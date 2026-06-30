import { z } from 'zod';

/** A token-bearing request used to consume single-use email tokens. */
export const consumeTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export type ConsumeTokenInput = z.infer<typeof consumeTokenSchema>;
