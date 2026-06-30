import { Link, useNavigate } from 'react-router-dom';
import { ActivityCard } from '@/components/ActivityCard';
import { ConnectedAccountsCard } from '@/components/ConnectedAccountsCard';
import { SessionsCard } from '@/components/SessionsCard';
import { TwoFactorCard } from '@/components/TwoFactorCard';
import { Button } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';

export function DashboardPage(): JSX.Element {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async (): Promise<void> => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <div className="flex items-center gap-4">
          {hasPermission('roles:read') ? (
            <Link to="/admin" className="text-sm font-semibold text-indigo-600 hover:underline">
              Admin
            </Link>
          ) : null}
          <Button type="button" onClick={handleLogout}>
            Sign out
          </Button>
        </div>
      </header>

      <div className="flex flex-col gap-6">
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-4 text-lg font-semibold text-slate-800">Your profile</h2>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Display name" value={user?.displayName ?? '—'} />
            <Field label="Username" value={user?.username ?? '—'} />
            <Field label="Email" value={user?.email ?? '—'} />
            <Field label="Email verified" value={user?.emailVerified ? 'Yes' : 'No'} />
          </dl>
        </section>

        <TwoFactorCard />
        <ConnectedAccountsCard />
        <SessionsCard />
        <ActivityCard />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-slate-800">{value}</dd>
    </div>
  );
}
