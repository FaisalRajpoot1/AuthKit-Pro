import { z } from 'zod';
import { emailSchema, strongPasswordSchema } from '../../utils/validation';

export const updateProfileSchema = z.object({
  // `null` clears the display name; omitting it leaves it unchanged.
  displayName: z.string().min(1).max(80).trim().nullable().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: strongPasswordSchema,
});

export const changeEmailSchema = z.object({
  newEmail: emailSchema,
  currentPassword: z.string().min(1, 'Current password is required'),
});

export const deleteAccountSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
});

export const availabilityQuerySchema = z
  .object({
    username: z.string().optional(),
    email: z.string().optional(),
  })
  .refine((value) => Boolean(value.username) || Boolean(value.email), {
    message: 'Provide a username or email to check',
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;
