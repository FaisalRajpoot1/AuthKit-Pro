import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listLinkedAccounts,
  PROVIDER_LABELS,
  startOAuthLink,
  unlinkAccount,
  type OAuthProvider,
} from '@/features/oauth/oauth.api';
import { getApiErrorMessage } from '@/lib/apiError';

const KEY = ['linked-accounts'];

export function ConnectedAccountsCard(): JSX.Element {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: KEY, queryFn: listLinkedAccounts });

  const unlink = useMutation({
    mutationFn: unlinkAccount,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });

  const available = data?.available ?? [];
  const linkedProviders = new Set((data?.accounts ?? []).map((a) => a.provider));
  const linkable = available.filter((p) => !linkedProviders.has(p));

  // Hide entirely if no providers are configured server-side.
  if (!isLoading && available.length === 0 && (data?.accounts.length ?? 0) === 0) {
    return <></>;
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="mb-4 text-lg font-semibold text-slate-800">Connected accounts</h2>

      {isLoading ? <p className="text-sm text-slate-500">Loading…</p> : null}

      <ul className="divide-y divide-slate-100">
        {(data?.accounts ?? []).map((account) => (
          <li key={account.provider} className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-slate-800">
                {PROVIDER_LABELS[account.provider]}
              </p>
              <p className="text-xs text-slate-500">{account.email ?? account.displayName ?? ''}</p>
            </div>
            <button
              type="button"
              onClick={() => unlink.mutate(account.provider)}
              disabled={unlink.isPending}
              className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
            >
              Unlink
            </button>
          </li>
        ))}
      </ul>

      {unlink.isError ? (
        <p className="mt-2 text-sm text-red-600">{getApiErrorMessage(unlink.error)}</p>
      ) : null}

      {linkable.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {linkable.map((provider: OAuthProvider) => (
            <button
              key={provider}
              type="button"
              onClick={() => void startOAuthLink(provider)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Link {PROVIDER_LABELS[provider]}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
