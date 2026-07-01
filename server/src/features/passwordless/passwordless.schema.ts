import { z } from 'zod';
import { emailSchema } from '../../utils/validation';

export const passwordlessRequestSchema = z.object({
  email: emailSchema,
});

export const magicVerifySchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export const otpVerifySchema = z.object({
  email: emailSchema,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit code'),
});

export type PasswordlessRequestInput = z.infer<typeof passwordlessRequestSchema>;
export type OtpVerifyInput = z.infer<typeof otpVerifySchema>;
