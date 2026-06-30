import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listSessions,
  revokeOtherSessions,
  revokeSession,
  type Session,
} from '@/features/sessions/sessions.api';
import { deviceLabel, formatDateTime } from '@/lib/format';

const SESSIONS_KEY = ['sessions'];

export function SessionsCard(): JSX.Element {
  const queryClient = useQueryClient();
  const { data: sessions, isLoading, isError } = useQuery({
    queryKey: SESSIONS_KEY,
    queryFn: listSessions,
  });

  const invalidate = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: SESSIONS_KEY }).then(() => undefined);

  const revokeOne = useMutation({ mutationFn: revokeSession, onSuccess: invalidate });
  const revokeOthers = useMutation({ mutationFn: revokeOtherSessions, onSuccess: invalidate });

  const hasOthers = (sessions ?? []).some((s) => !s.current);

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Active sessions</h2>
        {hasOthers ? (
          <button
            type="button"
            onClick={() => revokeOthers.mutate()}
            disabled={revokeOthers.isPending}
            className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
          >
            Log out other devices
          </button>
        ) : null}
      </div>

      {isLoading ? <p className="text-sm text-slate-500">Loading sessions…</p> : null}
      {isError ? <p className="text-sm text-red-600">Could not load sessions.</p> : null}

      <ul className="divide-y divide-slate-100">
        {(sessions ?? []).map((session) => (
          <SessionRow
            key={session.id}
            session={session}
            onRevoke={() => revokeOne.mutate(session.id)}
            revoking={revokeOne.isPending}
          />
        ))}
      </ul>
    </section>
  );
}

function SessionRow({
  session,
  onRevoke,
  revoking,
}: {
  session: Session;
  onRevoke: () => void;
  revoking: boolean;
}): JSX.Element {
  return (
    <li className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium text-slate-800">
          {deviceLabel(session.browser, session.os)}
          {session.current ? (
            <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              This device
            </span>
          ) : null}
        </p>
        <p className="text-xs text-slate-500">
          {[session.location, session.ipAddress].filter(Boolean).join(' · ') || 'Unknown location'}
          {' · last active '}
          {formatDateTime(session.lastUsedAt)}
        </p>
      </div>
      {!session.current ? (
        <button
          type="button"
          onClick={onRevoke}
          disabled={revoking}
          className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
        >
          Revoke
        </button>
      ) : null}
    </li>
  );
}
