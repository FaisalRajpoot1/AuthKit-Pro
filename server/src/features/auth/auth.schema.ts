import { z } from 'zod';
import { emailSchema, strongPasswordSchema, usernameSchema } from '../../utils/validation';

/**
 * Validation schemas for the auth feature. These are the single source of
 * truth for request shapes; inferred types flow into services and controllers.
 */
export const registerSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  password: strongPasswordSchema,
  displayName: z.string().min(1).max(80).trim().optional(),
});

export const loginSchema = z.object({
  // Accept either an email or a username in a single field.
  identifier: z.string().min(1, 'Email or username is required').trim(),
  password: z.string().min(1, 'Password is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
