import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  deleteNotification,
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '@/features/notifications/notifications.api';
import { formatDateTime } from '@/lib/format';

const UNREAD_KEY = ['notifications-unread'];
const LIST_KEY = ['notifications-list'];

export function NotificationsBell(): JSX.Element {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const unread = useQuery({
    queryKey: UNREAD_KEY,
    queryFn: getUnreadCount,
    refetchInterval: 30_000,
  });
  const list = useQuery({ queryKey: LIST_KEY, queryFn: listNotifications, enabled: open });

  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: UNREAD_KEY });
    void queryClient.invalidateQueries({ queryKey: LIST_KEY });
  };

  const markRead = useMutation({ mutationFn: markNotificationRead, onSuccess: refresh });
  const markAll = useMutation({ mutationFn: markAllNotificationsRead, onSuccess: refresh });
  const remove = useMutation({ mutationFn: deleteNotification, onSuccess: refresh });

  const count = unread.data ?? 0;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100"
        aria-label="Notifications"
      >
        <span className="text-lg">🔔</span>
        {count > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {count > 9 ? '9+' : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
              <p className="text-sm font-semibold text-slate-800">Notifications</p>
              <button
                type="button"
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending || count === 0}
                className="text-xs font-medium text-indigo-600 hover:underline disabled:opacity-40"
              >
                Mark all read
              </button>
            </div>

            <ul className="max-h-96 divide-y divide-slate-50 overflow-y-auto">
              {list.isLoading ? (
                <li className="px-4 py-6 text-center text-sm text-slate-500">Loading…</li>
              ) : null}
              {list.data && list.data.items.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-slate-500">You’re all caught up.</li>
              ) : null}
              {(list.data?.items ?? []).map((n) => (
                <Row
                  key={n.id}
                  notification={n}
                  onRead={() => markRead.mutate(n.id)}
                  onDelete={() => remove.mutate(n.id)}
                />
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Row({
  notification,
  onRead,
  onDelete,
}: {
  notification: AppNotification;
  onRead: () => void;
  onDelete: () => void;
}): JSX.Element {
  const isSecurity = notification.type === 'SECURITY_ALERT';
  return (
    <li className={`px-4 py-3 ${notification.read ? '' : 'bg-indigo-50/40'}`}>
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={onRead} className="flex-1 text-left">
          <p className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
            {isSecurity ? <span>🔒</span> : null}
            {notification.title}
            {!notification.read ? <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" /> : null}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">{notification.body}</p>
          <p className="mt-1 text-[11px] text-slate-400">{formatDateTime(notification.createdAt)}</p>
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="text-xs text-slate-400 hover:text-red-600"
          aria-label="Delete notification"
        >
          ✕
        </button>
      </div>
    </li>
  );
}
