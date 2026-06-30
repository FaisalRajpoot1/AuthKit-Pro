import { UAParser } from 'ua-parser-js';

/** Human-friendly device metadata derived from a User-Agent header. */
export interface DeviceInfo {
  deviceType: string; // desktop | mobile | tablet | console | wearable | smarttv | unknown
  browser: string | null;
  os: string | null;
}

/**
 * Parses a User-Agent string into coarse device metadata for the sessions
 * dashboard. ua-parser reports an empty device type for desktops, which we
 * normalize to "desktop".
 */
export function parseDevice(userAgent: string | undefined): DeviceInfo {
  if (!userAgent) {
    return { deviceType: 'unknown', browser: null, os: null };
  }

  const parsed = new UAParser(userAgent).getResult();
  return {
    deviceType: parsed.device.type ?? 'desktop',
    browser: parsed.browser.name ?? null,
    os: parsed.os.name ?? null,
  };
}
