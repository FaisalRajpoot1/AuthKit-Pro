import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import {
  getPushConfig,
  subscribePush,
  unsubscribePush,
} from '@/features/notifications/notifications.api';
import { getApiErrorMessage } from '@/lib/apiError';

const pushSupported =
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

/** Base64url VAPID key → ArrayBuffer, as required by PushManager.subscribe. */
function urlBase64ToBuffer(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normalized);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) view[i] = raw.charCodeAt(i);
  return buffer;
}

/** Lets the user enable/disable browser (Web Push) notifications for this device. */
export function PushNotificationsCard(): JSX.Element | null {
  const { data: config } = useQuery({ queryKey: ['push-config'], queryFn: getPushConfig });
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pushSupported) return;
    void navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(Boolean(sub)))
      .catch(() => undefined);
  }, []);

  // Hidden entirely when the browser can't do push or the server has no VAPID key.
  if (!pushSupported || !config || !config.enabled || !config.publicKey) {
    return null;
  }
  const publicKey = config.publicKey;

  const enable = async (): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setError('Notification permission was denied.');
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBuffer(publicKey),
      });
      await subscribePush(sub.toJSON());
      setSubscribed(true);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not enable push notifications'));
    } finally {
      setBusy(false);
    }
  };

  const disable = async (): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await unsubscribePush(sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not disable push notifications'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Browser notifications</h2>
        {subscribed ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
            On
          </span>
        ) : null}
      </div>
      <p className="mb-4 text-sm text-slate-600">
        Get security alerts and account updates as desktop notifications on this device.
      </p>
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      {subscribed ? (
        <button
          type="button"
          onClick={disable}
          disabled={busy}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Turn off
        </button>
      ) : (
        <Button type="button" onClick={enable} loading={busy}>
          Enable notifications
        </Button>
      )}
    </section>
  );
}
