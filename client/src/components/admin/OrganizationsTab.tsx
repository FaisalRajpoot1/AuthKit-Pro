import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { TextField } from '@/components/ui';
import { listAdminOrganizations } from '@/features/admin/admin.api';
import { formatDateTime } from '@/lib/format';

export function OrganizationsTab(): JSX.Element {
  const [search, setSearch] = useState('');

  const query = useInfiniteQuery({
    queryKey: ['admin-orgs', search],
    queryFn: ({ pageParam }) => listAdminOrganizations({ search: search || undefined, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const orgs = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-sm">
        <TextField label="Search organizations" placeholder="name…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">Organization</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Members</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {orgs.map((org) => (
              <tr key={org.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">{org.name}</p>
                  <p className="text-xs text-slate-500">/{org.slug}</p>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{org.ownerEmail}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{org.memberCount}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(org.createdAt)}</td>
              </tr>
            ))}
            {orgs.length === 0 && !query.isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-500">No organizations found.</td>
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
