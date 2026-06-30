/** Formats an ISO timestamp as a short, locale-aware date-time. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/** Turns an UPPER_SNAKE audit action into "Title case" words. */
export function humanizeAction(action: string): string {
  return action
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Builds a friendly device label from session metadata. */
export function deviceLabel(browser: string | null, os: string | null): string {
  if (browser && os) return `${browser} on ${os}`;
  return browser ?? os ?? 'Unknown device';
}
