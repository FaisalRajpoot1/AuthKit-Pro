import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getApiErrorMessage } from '@/lib/apiError';
import { AuthShell } from '@/components/AuthShell';

type Status = 'pending' | 'success' | 'error';

interface TokenActionPageProps {
  /** Performs the side effect with the token from the URL. */
  action: (token: string) => Promise<void>;
  pendingTitle: string;
  successTitle: string;
  successMessage: string;
}

/**
 * Generic page for links that carry a `?token=` and act immediately on load
 * (email verification, email-change confirmation). Runs the action once.
 */
export function TokenActionPage({
  action,
  pendingTitle,
  successTitle,
  successMessage,
}: TokenActionPageProps): JSX.Element {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<Status>('pending');
  const [error, setError] = useState<string | null>(null);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    if (!token) {
      setStatus('error');
      setError('This link is invalid or incomplete.');
      return;
    }

    action(token)
      .then(() => setStatus('success'))
      .catch((err: unknown) => {
        setStatus('error');
        setError(getApiErrorMessage(err, 'This link is invalid or has expired.'));
      });
  }, [action, token]);

  if (status === 'pending') {
    return <AuthShell title={pendingTitle} subtitle="One moment…"><Spinner /></AuthShell>;
  }

  if (status === 'success') {
    return (
      <AuthShell title={successTitle} subtitle="Success">
        <p className="text-sm text-slate-600">{successMessage}</p>
        <p className="mt-6 text-center text-sm text-slate-500">
          <Link to="/login" className="font-semibold text-indigo-600 hover:underline">
            Continue to sign in
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Something went wrong" subtitle="Link could not be processed">
      <p role="alert" className="text-sm text-red-600">
        {error}
      </p>
      <p className="mt-6 text-center text-sm text-slate-500">
        <Link to="/login" className="font-semibold text-indigo-600 hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}

function Spinner(): JSX.Element {
  return (
    <div className="flex justify-center py-4">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
    </div>
  );
}
