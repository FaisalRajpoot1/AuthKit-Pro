import { z } from 'zod';

/** A TOTP code (6 digits) or a backup code (e.g. ABCDE-FGHIJ). */
const codeSchema = z.string().min(6, 'Enter your authentication code').max(20).trim();

export const enableTwoFactorSchema = z.object({
  code: codeSchema,
});

export const disableTwoFactorSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

export const regenerateBackupCodesSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

export const setupSmsSchema = z.object({
  phoneNumber: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{6,14}$/, 'Enter a phone number in international format, e.g. +14155552671'),
});

export const verifySmsSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});

export type EnableTwoFactorInput = z.infer<typeof enableTwoFactorSchema>;
export type DisableTwoFactorInput = z.infer<typeof disableTwoFactorSchema>;
export type RegenerateBackupCodesInput = z.infer<typeof regenerateBackupCodesSchema>;
export type SetupSmsInput = z.infer<typeof setupSmsSchema>;
export type VerifySmsInput = z.infer<typeof verifySmsSchema>;
