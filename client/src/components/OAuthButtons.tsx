import { useState } from 'react';
import {
  PROVIDER_LABELS,
  startOAuthLogin,
  type OAuthProvider,
} from '@/features/oauth/oauth.api';
import { getApiErrorMessage } from '@/lib/apiError';

const PROVIDERS: OAuthProvider[] = ['GOOGLE', 'GITHUB', 'MICROSOFT', 'DISCORD'];

/**
 * Social sign-in buttons. A provider that isn't configured server-side simply
 * returns an error when clicked, surfaced inline.
 */
export function OAuthButtons(): JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<OAuthProvider | null>(null);

  const onClick = async (provider: OAuthProvider): Promise<void> => {
    setError(null);
    setPending(provider);
    try {
      await startOAuthLogin(provider);
    } catch (err) {
      setError(getApiErrorMessage(err, `${PROVIDER_LABELS[provider]} sign-in is unavailable`));
      setPending(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-slate-200" />
        <span className="text-xs uppercase tracking-wide text-slate-400">or continue with</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {PROVIDERS.map((provider) => (
          <button
            key={provider}
            type="button"
            onClick={() => onClick(provider)}
            disabled={pending !== null}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            {pending === provider ? 'Redirecting…' : PROVIDER_LABELS[provider]}
          </button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="text-center text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
