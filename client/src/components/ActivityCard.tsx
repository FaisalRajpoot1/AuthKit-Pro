import { useQuery } from '@tanstack/react-query';
import { listAuditLogs } from '@/features/audit/audit.api';
import { formatDateTime, humanizeAction } from '@/lib/format';

export function ActivityCard(): JSX.Element {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => listAuditLogs(10),
  });

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="mb-4 text-lg font-semibold text-slate-800">Recent activity</h2>

      {isLoading ? <p className="text-sm text-slate-500">Loading activity…</p> : null}
      {isError ? <p className="text-sm text-red-600">Could not load activity.</p> : null}
      {data && data.items.length === 0 ? (
        <p className="text-sm text-slate-500">No activity yet.</p>
      ) : null}

      <ul className="divide-y divide-slate-100">
        {(data?.items ?? []).map((log) => (
          <li key={log.id} className="flex items-center justify-between py-2.5">
            <span className="text-sm font-medium text-slate-700">{humanizeAction(log.action)}</span>
            <span className="text-xs text-slate-400">
              {[log.ipAddress, formatDateTime(log.createdAt)].filter(Boolean).join(' · ')}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
