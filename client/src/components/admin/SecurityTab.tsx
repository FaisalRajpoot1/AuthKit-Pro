import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, TextField } from '@/components/ui';
import { blockIp, listBlockedIps, unblockIp } from '@/features/admin/admin.api';
import { formatDateTime } from '@/lib/format';
import { getApiErrorMessage } from '@/lib/apiError';

const KEY = ['admin-blocked-ips'];

/** Admin security controls: block/unblock IP addresses. */
export function SecurityTab(): JSX.Element {
  const queryClient = useQueryClient();
  const { data: blocked = [], isLoading } = useQuery({ queryKey: KEY, queryFn: listBlockedIps });

  const [ipAddress, setIpAddress] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const invalidate = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: KEY }).then(() => undefined);

  const block = useMutation({
    mutationFn: () =>
      blockIp({ ipAddress: ipAddress.trim(), reason: reason.trim() || undefined }),
    onSuccess: async () => {
      setIpAddress('');
      setReason('');
      setError(null);
      await invalidate();
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not block that IP')),
  });

  const unblock = useMutation({
    mutationFn: unblockIp,
    onSuccess: invalidate,
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">Block an IP address</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-56">
            <TextField
              label="IP address"
              placeholder="203.0.113.7"
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
            />
          </div>
          <div className="flex-1 min-w-56">
            <TextField
              label="Reason (optional)"
              placeholder="abuse"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <Button
            type="button"
            onClick={() => block.mutate()}
            loading={block.isPending}
            disabled={!ipAddress.trim()}
          >
            Block
          </Button>
        </div>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </section>

      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">IP address</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Blocked</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {blocked.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3 font-mono text-xs text-slate-700">{row.ipAddress}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{row.reason ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(row.createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => unblock.mutate(row.id)}
                    disabled={unblock.isPending}
                    className="text-xs font-medium text-indigo-600 hover:underline disabled:opacity-50"
                  >
                    Unblock
                  </button>
                </td>
              </tr>
            ))}
            {blocked.length === 0 && !isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-500">
                  No blocked IP addresses.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
