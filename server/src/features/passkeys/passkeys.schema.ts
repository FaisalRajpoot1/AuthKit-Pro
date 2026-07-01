import { z } from 'zod';
import { emailSchema } from '../../utils/validation';

// The full WebAuthn response is validated by @simplewebauthn; we only assert the
// shape needed to route it (an id) and pass the rest through.
const passkeyResponseSchema = z.object({ id: z.string() }).passthrough();

export const registrationVerifySchema = z.object({
  response: passkeyResponseSchema,
  name: z.string().max(60).trim().optional(),
});

export const authenticationOptionsSchema = z.object({
  email: emailSchema.optional(),
});

export const authenticationVerifySchema = z.object({
  response: passkeyResponseSchema,
});
