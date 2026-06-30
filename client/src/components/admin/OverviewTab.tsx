import { useQuery } from '@tanstack/react-query';
import { getStats } from '@/features/admin/admin.api';

export function OverviewTab(): JSX.Element {
  const { data, isLoading, isError } = useQuery({ queryKey: ['admin-stats'], queryFn: getStats });

  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (isError || !data) return <p className="text-sm text-red-600">Could not load statistics.</p>;

  const cards: Array<{ label: string; value: number; hint?: string }> = [
    { label: 'Total users', value: data.users.total },
    { label: 'Active users', value: data.users.active },
    { label: 'Verified emails', value: data.users.verified },
    { label: '2FA enabled', value: data.users.twoFactor },
    { label: 'New (7 days)', value: data.users.new7d },
    { label: 'New (30 days)', value: data.users.new30d },
    { label: 'Organizations', value: data.organizations },
    { label: 'Active sessions', value: data.activeSessions },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="text-2xl font-bold text-slate-900">{card.value}</p>
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">{card.label}</p>
        </div>
      ))}
    </div>
  );
}
