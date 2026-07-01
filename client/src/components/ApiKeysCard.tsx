import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, TextField } from '@/components/ui';
import {
  createApiKey,
  listApiKeys,
  listScopes,
  revokeApiKey,
  type ApiKey,
} from '@/features/api-keys/apiKeys.api';
import { getApiErrorMessage } from '@/lib/apiError';
import { formatDateTime } from '@/lib/format';

const KEYS_QUERY = ['api-keys'];

export function ApiKeysCard(): JSX.Element {
  const queryClient = useQueryClient();
  const { data: keys, isLoading } = useQuery({ queryKey: KEYS_QUERY, queryFn: listApiKeys });
  const { data: scopes } = useQuery({ queryKey: ['api-scopes'], queryFn: listScopes });

  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const invalidate = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: KEYS_QUERY }).then(() => undefined);

  const create = useMutation({
    mutationFn: () => createApiKey({ name: name.trim(), scopes: [...selected] }),
    onSuccess: (result) => {
      setNewSecret(result.secret);
      setName('');
      setSelected(new Set());
      setError(null);
      void invalidate();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const revoke = useMutation({ mutationFn: revokeApiKey, onSuccess: invalidate });

  const toggleScope = (key: string): void => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="mb-4 text-lg font-semibold text-slate-800">API keys</h2>

      {newSecret ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">
            Copy your new API key now — it won&apos;t be shown again.
          </p>
          <code className="mt-2 block break-all rounded bg-white/70 px-2 py-1 font-mono text-sm text-amber-950">
            {newSecret}
          </code>
          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(newSecret)}
              className="text-xs font-semibold text-amber-800 hover:underline"
            >
              Copy
            </button>
            <button
              type="button"
              onClick={() => setNewSecret(null)}
              className="text-xs font-semibold text-slate-500 hover:underline"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}

      {/* Create */}
      <div className="mb-6 flex flex-col gap-3 rounded-xl bg-slate-50 p-4">
        <TextField label="Key name" placeholder="CI deploy" value={name} onChange={(e) => setName(e.target.value)} />
        <div>
          <p className="mb-1 text-sm font-medium text-slate-700">Scopes</p>
          <div className="flex flex-col gap-1">
            {(scopes ?? []).map((scope) => (
              <label key={scope.key} className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={selected.has(scope.key)}
                  onChange={() => toggleScope(scope.key)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span className="font-mono text-xs">{scope.key}</span>
                <span className="text-xs text-slate-400">— {scope.description}</span>
              </label>
            ))}
          </div>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div>
          <Button
            type="button"
            onClick={() => create.mutate()}
            loading={create.isPending}
            disabled={!name.trim() || selected.size === 0}
          >
            Create key
          </Button>
        </div>
      </div>

      {/* List */}
      {isLoading ? <p className="text-sm text-slate-500">Loading…</p> : null}
      <ul className="divide-y divide-slate-100">
        {(keys ?? []).map((key) => (
          <ApiKeyRow key={key.id} apiKey={key} onRevoke={() => revoke.mutate(key.id)} revoking={revoke.isPending} />
        ))}
        {keys && keys.length === 0 ? <li className="py-2 text-sm text-slate-500">No API keys yet.</li> : null}
      </ul>
    </section>
  );
}

function ApiKeyRow({
  apiKey,
  onRevoke,
  revoking,
}: {
  apiKey: ApiKey;
  onRevoke: () => void;
  revoking: boolean;
}): JSX.Element {
  return (
    <li className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium text-slate-800">
          {apiKey.name}
          {apiKey.revoked ? (
            <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">revoked</span>
          ) : null}
        </p>
        <p className="font-mono text-xs text-slate-500">{apiKey.prefix}… · {apiKey.scopes.join(', ')}</p>
        <p className="text-xs text-slate-400">
          Created {formatDateTime(apiKey.createdAt)}
          {apiKey.expiresAt ? ` · expires ${formatDateTime(apiKey.expiresAt)}` : ''}
          {apiKey.lastUsedAt ? ` · last used ${formatDateTime(apiKey.lastUsedAt)}` : ''}
        </p>
      </div>
      {!apiKey.revoked ? (
        <button
          type="button"
          onClick={onRevoke}
          disabled={revoking}
          className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
        >
          Revoke
        </button>
      ) : null}
    </li>
  );
}
