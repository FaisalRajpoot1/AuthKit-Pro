import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, TextField } from '@/components/ui';
import {
  deletePasskey,
  listPasskeys,
  passkeysSupported,
  registerPasskey,
} from '@/features/passkeys/passkeys.api';
import { getApiErrorMessage } from '@/lib/apiError';
import { formatDateTime } from '@/lib/format';

const KEY = ['passkeys'];

export function PasskeysCard(): JSX.Element {
  const queryClient = useQueryClient();
  const { data: passkeys, isLoading } = useQuery({ queryKey: KEY, queryFn: listPasskeys });
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const invalidate = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: KEY }).then(() => undefined);

  const add = useMutation({
    mutationFn: () => registerPasskey(name.trim() || undefined),
    onSuccess: () => {
      setName('');
      setError(null);
      void invalidate();
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not add passkey')),
  });
  const remove = useMutation({ mutationFn: deletePasskey, onSuccess: invalidate });

  if (!passkeysSupported()) return <></>;

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="mb-4 text-lg font-semibold text-slate-800">Passkeys</h2>
      <p className="mb-4 text-sm text-slate-600">
        Sign in with your device (Face ID, Touch ID, Windows Hello, or a security key) — no password
        needed.
      </p>

      <div className="mb-4 flex flex-col gap-2 rounded-xl bg-slate-50 p-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <TextField label="Passkey name (optional)" placeholder="MacBook" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button type="button" onClick={() => add.mutate()} loading={add.isPending}>
          Add a passkey
        </Button>
      </div>
      {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}

      {isLoading ? <p className="text-sm text-slate-500">Loading…</p> : null}
      <ul className="divide-y divide-slate-100">
        {(passkeys ?? []).map((passkey) => (
          <li key={passkey.id} className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-slate-800">{passkey.name ?? 'Passkey'}</p>
              <p className="text-xs text-slate-400">
                {passkey.deviceType === 'multiDevice' ? 'Synced' : 'This device'} · added{' '}
                {formatDateTime(passkey.createdAt)}
                {passkey.lastUsedAt ? ` · last used ${formatDateTime(passkey.lastUsedAt)}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => remove.mutate(passkey.id)}
              disabled={remove.isPending}
              className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
            >
              Remove
            </button>
          </li>
        ))}
        {passkeys && passkeys.length === 0 ? (
          <li className="py-2 text-sm text-slate-500">No passkeys yet.</li>
        ) : null}
      </ul>
    </section>
  );
}
