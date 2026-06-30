import { describe, expect, it } from 'vitest';
import { parseDevice } from './device';

describe('parseDevice', () => {
  it('returns unknown for a missing user-agent', () => {
    expect(parseDevice(undefined)).toEqual({ deviceType: 'unknown', browser: null, os: null });
  });

  it('normalizes a desktop user-agent (empty device type → desktop)', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
    const result = parseDevice(ua);
    expect(result.deviceType).toBe('desktop');
    expect(result.browser).toBe('Chrome');
    expect(result.os).toBe('Windows');
  });

  it('detects a mobile device', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    const result = parseDevice(ua);
    expect(result.deviceType).toBe('mobile');
    expect(result.os).toBe('iOS');
  });
});
