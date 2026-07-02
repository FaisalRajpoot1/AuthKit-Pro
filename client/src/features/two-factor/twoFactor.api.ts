import { apiClient } from '@/lib/apiClient';

export interface TwoFactorStatus {
  enabled: boolean;
  backupCodesRemaining: number;
  sms: { enabled: boolean; phone: string | null };
}

export interface TwoFactorSetup {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

export async function getTwoFactorStatus(): Promise<TwoFactorStatus> {
  const { data } = await apiClient.get<TwoFactorStatus>('/account/2fa');
  return data;
}

export async function setupTwoFactor(): Promise<TwoFactorSetup> {
  const { data } = await apiClient.post<TwoFactorSetup>('/account/2fa/setup');
  return data;
}

export async function enableTwoFactor(code: string): Promise<string[]> {
  const { data } = await apiClient.post<{ backupCodes: string[] }>('/account/2fa/enable', { code });
  return data.backupCodes;
}

export async function disableTwoFactor(password: string): Promise<void> {
  await apiClient.post('/account/2fa/disable', { password });
}

export async function regenerateBackupCodes(password: string): Promise<string[]> {
  const { data } = await apiClient.post<{ backupCodes: string[] }>('/account/2fa/backup-codes', {
    password,
  });
  return data.backupCodes;
}

/** Register a phone for SMS 2FA; the server texts a verification code. */
export async function setupSmsFactor(phoneNumber: string): Promise<void> {
  await apiClient.post('/account/2fa/sms/setup', { phoneNumber });
}

/** Confirm the texted code to enable SMS as a 2FA channel. */
export async function verifySmsFactor(code: string): Promise<void> {
  await apiClient.post('/account/2fa/sms/verify', { code });
}

/** Remove the SMS 2FA channel. */
export async function removeSmsFactor(): Promise<void> {
  await apiClient.delete('/account/2fa/sms');
}
