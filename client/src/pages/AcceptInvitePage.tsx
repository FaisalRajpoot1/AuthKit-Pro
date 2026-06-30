import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { acceptInvite } from '@/features/organizations/organizations.api';
import { getApiErrorMessage } from '@/lib/apiError';
import { AuthShell } from './LoginPage';

type Status = 'pending' | 'success' | 'error';

export function AcceptInvitePage(): JSX.Element {
  const [params] = useSearchParams();
  const token = params.get('token');
  const { isInitializing, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('pending');
  const [error, setError] = useState<string | null>(null);
  const hasRun = useRef(false);

  useEffect(() => {
    if (isInitializing || !isAuthenticated || hasRun.current) return;
    hasRun.current = true;

    if (!token) {
      setStatus('error');
      setError('This invitation link is invalid.');
      return;
    }

    acceptInvite(token)
      .then(() => setStatus('success'))
      .catch((err: unknown) => {
        setStatus('error');
        setError(getApiErrorMessage(err, 'This invitation is invalid or has expired.'));
      });
  }, [isInitializing, isAuthenticated, token]);

  if (!isInitializing && !isAuthenticated) {
    return (
      <AuthShell title="Sign in to continue" subtitle="You need an account to accept this invite">
        <p className="text-sm text-slate-600">Please sign in or create an account, then open the invite link again.</p>
        <p className="mt-6 text-center text-sm text-slate-500">
          <Link to="/login" className="font-semibold text-indigo-600 hover:underline">
            Go to sign in
          </Link>
        </p>
      </AuthShell>
    );
  }

  if (status === 'success') {
    return (
      <AuthShell title="Invitation accepted" subtitle="You're in">
        <p className="text-sm text-slate-600">You’ve joined the organization.</p>
        <p className="mt-6 text-center text-sm text-slate-500">
          <button
            type="button"
            onClick={() => navigate('/organizations', { replace: true })}
            className="font-semibold text-indigo-600 hover:underline"
          >
            View organizations
          </button>
        </p>
      </AuthShell>
    );
  }

  if (status === 'error') {
    return (
      <AuthShell title="Couldn’t accept invite" subtitle="Something went wrong">
        <p role="alert" className="text-sm text-red-600">{error}</p>
        <p className="mt-6 text-center text-sm text-slate-500">
          <Link to="/dashboard" className="font-semibold text-indigo-600 hover:underline">
            Back to dashboard
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Accepting invitation" subtitle="One moment…">
      <div className="flex justify-center py-4">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
      </div>
    </AuthShell>
  );
}
