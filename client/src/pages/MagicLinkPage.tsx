import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthShell } from '@/components/AuthShell';
import { TwoFactorStep } from '@/components/TwoFactorStep';
import { verifyMagicLink } from '@/features/auth/auth.api';
import { useAuth } from '@/features/auth/AuthContext';
import { getApiErrorMessage } from '@/lib/apiError';

type Status = 'pending' | 'error';

/** Consumes a magic-link token from the URL and completes sign-in. */
export function MagicLinkPage(): JSX.Element {
  const [params] = useSearchParams();
  const token = params.get('token');
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('pending');
  const [error, setError] = useState<string | null>(null);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    if (!token) {
      setStatus('error');
      setError('This sign-in link is invalid.');
      return;
    }

    verifyMagicLink(token)
      .then(async (result) => {
        if (result.kind === 'two_factor_required') {
          setChallengeToken(result.challengeToken);
          return;
        }
        await refresh();
        navigate('/dashboard', { replace: true });
      })
      .catch((err: unknown) => {
        setStatus('error');
        setError(getApiErrorMessage(err, 'This sign-in link is invalid or has expired.'));
      });
  }, [token, refresh, navigate]);

  if (challengeToken) {
    return <TwoFactorStep challengeToken={challengeToken} onCancel={() => navigate('/login')} />;
  }

  if (status === 'error') {
    return (
      <AuthShell title="Sign-in failed" subtitle="Link could not be used">
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
        <p className="mt-6 text-center text-sm text-slate-500">
          <Link to="/passwordless" className="font-semibold text-indigo-600 hover:underline">
            Request a new link
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Signing you in" subtitle="One moment…">
      <div className="flex justify-center py-4">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
      </div>
    </AuthShell>
  );
}
