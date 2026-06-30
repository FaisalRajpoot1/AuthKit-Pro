import { isIP } from 'node:net';

/**
 * Resolves a coarse human-readable location ("City, Country") for an IP.
 *
 * This is the seam where a geo-IP provider (MaxMind GeoLite2, ipinfo, etc.)
 * plugs in. Until one is configured it returns null — private/loopback
 * addresses never resolve — so callers store `null` rather than fabricating a
 * location. Sessions and audit logs keep the raw IP regardless.
 */
export function lookupLocation(ip: string | undefined): string | null {
  if (!ip || isIP(ip) === 0) return null;
  if (isPrivateAddress(ip)) return null;
  // No provider configured yet.
  return null;
}

function isPrivateAddress(ip: string): boolean {
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('::ffff:') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  );
}
