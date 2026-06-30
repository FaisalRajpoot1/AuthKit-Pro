import { z } from 'zod';

/** Public user shape returned by the API. Mirrors the server's UserDto. */
export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  emailVerified: boolean;
  createdAt: string;
}

/** Successful auth response: user profile + short-lived access token. */
export interface AuthResponse {
  user: User;
  accessToken: string;
}

// Client-side validation mirrors the server contract for instant feedback.
export const loginFormSchema = z.object({
  identifier: z.string().min(1, 'Email or username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const registerFormSchema = z.object({
  email: z.string().email('Enter a valid email'),
  username: z
    .string()
    .min(3, 'At least 3 characters')
    .max(30, 'At most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers, and underscores only'),
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[a-z]/, 'Needs a lowercase letter')
    .regex(/[A-Z]/, 'Needs an uppercase letter')
    .regex(/[0-9]/, 'Needs a number'),
  displayName: z.string().max(80).optional(),
});

export const forgotPasswordFormSchema = z.object({
  email: z.string().email('Enter a valid email'),
});

export const resetPasswordFormSchema = z.object({
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[a-z]/, 'Needs a lowercase letter')
    .regex(/[A-Z]/, 'Needs an uppercase letter')
    .regex(/[0-9]/, 'Needs a number'),
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;
export type RegisterFormValues = z.infer<typeof registerFormSchema>;
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordFormSchema>;
export type ResetPasswordFormValues = z.infer<typeof resetPasswordFormSchema>;
