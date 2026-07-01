import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { isPasswordPwned } from './pwnedPasswords';

function suffixOf(password: string): string {
  return createHash('sha1').update(password).digest('hex').toUpperCase().slice(5);
}

function rangeResponse(body: string): Response {
  return new Response(body, { status: 200 });
}

describe('isPasswordPwned', () => {
  it('returns true when the suffix appears with a non-zero count', async () => {
    const suffix = suffixOf('password');
    const fetchMock = vi.fn(async () =>
      rangeResponse(`00000000000000000000000000000000000:1\r\n${suffix}:12345`),
    ) as unknown as typeof fetch;

    expect(await isPasswordPwned('password', fetchMock)).toBe(true);
  });

  it('returns false when the suffix is not in the range', async () => {
    const fetchMock = vi.fn(async () =>
      rangeResponse('00000000000000000000000000000000000:1'),
    ) as unknown as typeof fetch;

    expect(await isPasswordPwned('a-very-unique-passphrase', fetchMock)).toBe(false);
  });

  it('ignores padding entries (count 0)', async () => {
    const suffix = suffixOf('padded');
    const fetchMock = vi.fn(async () => rangeResponse(`${suffix}:0`)) as unknown as typeof fetch;

    expect(await isPasswordPwned('padded', fetchMock)).toBe(false);
  });

  it('fails open on a non-OK response', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 503 })) as unknown as typeof fetch;
    expect(await isPasswordPwned('anything', fetchMock)).toBe(false);
  });

  it('fails open on a network error', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    expect(await isPasswordPwned('anything', fetchMock)).toBe(false);
  });

  it('sends only the 5-char SHA-1 prefix (k-anonymity)', async () => {
    const fetchMock = vi.fn(async () => rangeResponse('')) as unknown as typeof fetch;
    await isPasswordPwned('secret', fetchMock);

    const url = String((fetchMock as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]?.[0]);
    const prefix = createHash('sha1').update('secret').digest('hex').toUpperCase().slice(0, 5);
    expect(url.endsWith(prefix)).toBe(true);
  });
});
