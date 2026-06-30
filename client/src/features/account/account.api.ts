import { apiClient } from '@/lib/apiClient';
import type { User } from '@/features/auth/auth.types';

/** Update the caller's profile (currently the display name). */
export async function updateProfile(displayName: string | null): Promise<User> {
  const { data } = await apiClient.patch<{ user: User }>('/account/profile', { displayName });
  return data.user;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiClient.post('/account/change-password', { currentPassword, newPassword });
}

/** Request an email change — a confirmation link is sent to the new address. */
export async function changeEmail(newEmail: string, currentPassword: string): Promise<void> {
  await apiClient.post('/account/change-email', { newEmail, currentPassword });
}
