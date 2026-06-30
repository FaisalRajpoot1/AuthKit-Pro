import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { AuthShell } from './LoginPage';

/**
 * Landing page after the OAuth provider redirect. The backend has already set
 * the refresh cookie, so on a full reload the AuthProvider restores the session
 * automatically; here we just wait for that and route accordingly.
 */
export function OAuthCallbackPage(): JSX.Element {
  const [params] = useSearchParams();
  const status = params.get('status');
  const { isInitializing, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === 'error' || isInitializing) return;
    navigate(isAuthenticated ? '/dashboard' : '/login', { replace: true });
  }, [status, isInitializing, isAuthenticated, navigate]);

  if (status === 'error') {
    return (
      <AuthShell title="Sign-in failed" subtitle="We couldn't complete that request">
        <p className="text-sm text-slate-600">
          The provider sign-in could not be completed. Please try again.
        </p>
        <p className="mt-6 text-center text-sm text-slate-500">
          <Link to="/login" className="font-semibold text-indigo-600 hover:underline">
            Back to sign in
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Completing sign-in" subtitle="One moment…">
      <div className="flex justify-center py-4">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
      </div>
    </AuthShell>
  );
}
