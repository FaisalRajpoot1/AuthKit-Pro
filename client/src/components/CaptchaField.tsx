import { useEffect, useRef } from 'react';
import { setCaptchaToken } from '@/lib/apiClient';

/**
 * Cloudflare Turnstile CAPTCHA widget. Renders nothing unless
 * `VITE_TURNSTILE_SITE_KEY` is configured, so it's a no-op by default (matching
 * the server, where CAPTCHA is off unless enabled). When solved, the token is
 * handed to the API client, which attaches it as `X-Captcha-Token` on the next
 * request (login/register/etc.).
 */

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

interface Turnstile {
  render: (
    el: HTMLElement,
    opts: { sitekey: string; callback: (token: string) => void; 'expired-callback'?: () => void },
  ) => string;
}

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

function loadScript(): Promise<void> {
  if (document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load CAPTCHA'));
    document.head.appendChild(script);
  });
}

export function CaptchaField(): JSX.Element | null {
  const ref = useRef<HTMLDivElement>(null);
  const rendered = useRef(false);

  useEffect(() => {
    if (!SITE_KEY || rendered.current) return;
    let cancelled = false;

    void loadScript().then(() => {
      if (cancelled || !ref.current || !window.turnstile || rendered.current) return;
      rendered.current = true;
      window.turnstile.render(ref.current, {
        sitekey: SITE_KEY,
        callback: (token) => setCaptchaToken(token),
        'expired-callback': () => setCaptchaToken(null),
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!SITE_KEY) return null;
  return <div ref={ref} className="flex justify-center" />;
}
