import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, TextField } from '@/components/ui';
import { BackupCodes } from '@/components/BackupCodes';
import {
  disableTwoFactor,
  enableTwoFactor,
  getTwoFactorStatus,
  setupTwoFactor,
  type TwoFactorSetup,
} from '@/features/two-factor/twoFactor.api';
import { getApiErrorMessage } from '@/lib/apiError';

const STATUS_KEY = ['two-factor-status'];

export function TwoFactorCard(): JSX.Element {
  const queryClient = useQueryClient();
  const { data: status, isLoading } = useQuery({
    queryKey: STATUS_KEY,
    queryFn: getTwoFactorStatus,
  });

  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  const refreshStatus = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: STATUS_KEY }).then(() => undefined);

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Two-factor authentication</h2>
        {status ? (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              status.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {status.enabled ? 'Enabled' : 'Disabled'}
          </span>
        ) : null}
      </div>

      {isLoading ? <p className="text-sm text-slate-500">Loading…</p> : null}

      {backupCodes ? (
        <div className="flex flex-col gap-3">
          <BackupCodes codes={backupCodes} />
          <Button type="button" onClick={() => setBackupCodes(null)}>
            Done
          </Button>
        </div>
      ) : status?.enabled ? (
        <EnabledView remaining={status.backupCodesRemaining} onDisabled={refreshStatus} />
      ) : setup ? (
        <EnrollView
          setup={setup}
          onCancel={() => setSetup(null)}
          onEnabled={async (codes) => {
            setSetup(null);
            setBackupCodes(codes);
            await refreshStatus();
          }}
        />
      ) : (
        <StartView onStarted={setSetup} />
      )}
    </section>
  );
}

function StartView({ onStarted }: { onStarted: (setup: TwoFactorSetup) => void }): JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: setupTwoFactor,
    onSuccess: onStarted,
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-slate-600">
        Add an extra layer of security using an authenticator app (Google Authenticator, Authy, 1Password).
      </p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div>
        <Button type="button" onClick={() => mutation.mutate()} loading={mutation.isPending}>
          Enable 2FA
        </Button>
      </div>
    </div>
  );
}

function EnrollView({
  setup,
  onCancel,
  onEnabled,
}: {
  setup: TwoFactorSetup;
  onCancel: () => void;
  onEnabled: (codes: string[]) => void | Promise<void>;
}): JSX.Element {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: () => enableTwoFactor(code.trim()),
    onSuccess: (codes) => onEnabled(codes),
    onError: (err) => setError(getApiErrorMessage(err, 'Invalid code')),
  });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600">
        Scan this QR code with your authenticator app, then enter the 6-digit code to confirm.
      </p>
      <img src={setup.qrCodeDataUrl} alt="2FA QR code" className="mx-auto h-44 w-44" />
      <p className="break-all text-center font-mono text-xs text-slate-500">{setup.secret}</p>
      <TextField
        label="6-digit code"
        inputMode="numeric"
        autoComplete="one-time-code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="button" onClick={() => mutation.mutate()} loading={mutation.isPending}>
          Confirm & enable
        </Button>
        <button type="button" onClick={onCancel} className="text-sm text-slate-500 hover:underline">
          Cancel
        </button>
      </div>
    </div>
  );
}

function EnabledView({
  remaining,
  onDisabled,
}: {
  remaining: number;
  onDisabled: () => void | Promise<void>;
}): JSX.Element {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: () => disableTwoFactor(password),
    onSuccess: () => onDisabled(),
    onError: (err) => setError(getApiErrorMessage(err, 'Could not disable 2FA')),
  });

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-slate-600">
        Two-factor authentication is active. You have{' '}
        <span className="font-semibold">{remaining}</span> backup codes remaining.
      </p>
      <TextField
        label="Confirm password to disable"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div>
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !password}
          className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          Disable 2FA
        </button>
      </div>
    </div>
  );
}
