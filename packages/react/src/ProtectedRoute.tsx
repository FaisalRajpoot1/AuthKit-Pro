import type { ReactNode } from 'react';
import { useAuth } from './hooks.js';

interface ProtectedRouteProps {
  children: ReactNode;
  /** Rendered when the user is not authenticated (e.g. a redirect or message). */
  fallback?: ReactNode;
  /** Rendered while the session is being restored. */
  loading?: ReactNode;
}

/**
 * Renders `children` only when authenticated. Framework-agnostic: pass a
 * redirect component (e.g. React Router's <Navigate />) as `fallback`.
 */
export function ProtectedRoute({
  children,
  fallback = null,
  loading = null,
}: ProtectedRouteProps): JSX.Element {
  const { status } = useAuth();

  if (status === 'loading') return <>{loading}</>;
  if (status === 'unauthenticated') return <>{fallback}</>;
  return <>{children}</>;
}
