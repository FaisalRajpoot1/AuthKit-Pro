import { z } from 'zod';

/**
 * Validation schemas for the auth feature. These are the single source of
 * truth for request shapes; inferred types flow into services and controllers.
 */
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be at most 30 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores');

export const registerSchema = z.object({
  email: z.string().email('A valid email is required').toLowerCase().trim(),
  username: usernameSchema,
  password: passwordSchema,
  displayName: z.string().min(1).max(80).trim().optional(),
});

export const loginSchema = z.object({
  // Accept either an email or a username in a single field.
  identifier: z.string().min(1, 'Email or username is required').trim(),
  password: z.string().min(1, 'Password is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
