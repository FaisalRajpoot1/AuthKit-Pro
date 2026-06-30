import { useInfiniteQuery } from '@tanstack/react-query';
import { listAdminAuditLogs } from '@/features/admin/admin.api';
import { formatDateTime, humanizeAction } from '@/lib/format';

export function AuditTab(): JSX.Element {
  const query = useInfiniteQuery({
    queryKey: ['admin-audit'],
    queryFn: ({ pageParam }) => listAdminAuditLogs({ cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const logs = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">IP</th>
              <th className="px-4 py-3">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="px-4 py-3 font-medium text-slate-700">{humanizeAction(log.action)}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{log.userEmail ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{log.ipAddress ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(log.createdAt)}</td>
              </tr>
            ))}
            {logs.length === 0 && !query.isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-500">No activity yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {query.hasNextPage ? (
        <button
          type="button"
          onClick={() => query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
          className="self-center text-sm font-medium text-indigo-600 hover:underline disabled:opacity-50"
        >
          {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
        </button>
      ) : null}
    </div>
  );
}
