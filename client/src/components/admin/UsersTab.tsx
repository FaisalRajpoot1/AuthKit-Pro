import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { TextField } from '@/components/ui';
import { listUsers, setUserActive, unlockUser } from '@/features/admin/admin.api';
import { formatDateTime } from '@/lib/format';

export function UsersTab({ canManage }: { canManage: boolean }): JSX.Element {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const query = useInfiniteQuery({
    queryKey: ['admin-users', search],
    queryFn: ({ pageParam }) => listUsers({ search: search || undefined, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const invalidate = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: ['admin-users'] }).then(() => undefined);

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => setUserActive(id, isActive),
    onSuccess: invalidate,
  });
  const unlock = useMutation({ mutationFn: unlockUser, onSuccess: invalidate });

  const users = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-sm">
        <TextField label="Search users" placeholder="email, username…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Roles</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Joined</th>
              {canManage ? <th className="px-4 py-3" /> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">{user.displayName ?? user.username}</p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                  <p className="mt-0.5 flex gap-1 text-[10px] uppercase text-slate-400">
                    {user.emailVerified ? <span>verified</span> : <span>unverified</span>}
                    {user.twoFactorEnabled ? <span>· 2FA</span> : null}
                  </p>
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">{user.roles.join(', ') || '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${user.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {user.isActive ? 'active' : 'disabled'}
                    </span>
                    {user.locked ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                        locked
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(user.createdAt)}</td>
                {canManage ? (
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      {user.locked ? (
                        <button
                          type="button"
                          onClick={() => unlock.mutate(user.id)}
                          disabled={unlock.isPending}
                          className="text-xs font-medium text-amber-700 hover:underline disabled:opacity-50"
                        >
                          Unlock
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => toggle.mutate({ id: user.id, isActive: !user.isActive })}
                        disabled={toggle.isPending}
                        className={`text-xs font-medium hover:underline disabled:opacity-50 ${user.isActive ? 'text-red-600' : 'text-emerald-600'}`}
                      >
                        {user.isActive ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
            {users.length === 0 && !query.isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">No users found.</td>
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
