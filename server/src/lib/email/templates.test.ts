import { describe, expect, it } from 'vitest';
import { suspiciousLoginTemplate, welcomeTemplate } from './templates';

describe('welcomeTemplate', () => {
  it('greets by name when provided', () => {
    const msg = welcomeTemplate('a@b.co', 'Ada');
    expect(msg.to).toBe('a@b.co');
    expect(msg.subject).toMatch(/welcome/i);
    expect(msg.html).toContain('Hi Ada,');
    expect(msg.text).toContain('Hi Ada,');
  });

  it('falls back to a generic greeting without a name', () => {
    const msg = welcomeTemplate('a@b.co', null);
    expect(msg.html).toContain('Hi there,');
  });
});

describe('suspiciousLoginTemplate', () => {
  it('includes the IP, device, and time', () => {
    const msg = suspiciousLoginTemplate('a@b.co', {
      ipAddress: '203.0.113.5',
      userAgent: 'Chrome/Windows',
      when: '2026-07-02T00:00:00.000Z',
    });
    expect(msg.subject).toMatch(/new sign-in/i);
    expect(msg.html).toContain('203.0.113.5');
    expect(msg.html).toContain('Chrome/Windows');
    expect(msg.text).toContain('2026-07-02T00:00:00.000Z');
  });

  it('handles unknown IP/device gracefully', () => {
    const msg = suspiciousLoginTemplate('a@b.co', {
      ipAddress: null,
      userAgent: null,
      when: 'now',
    });
    expect(msg.html).toContain('unknown');
  });
});
