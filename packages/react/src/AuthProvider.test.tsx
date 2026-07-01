import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider } from './AuthProvider.js';
import { useAuth } from './hooks.js';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function Probe(): JSX.Element {
  const { status, isAuthenticated, user } = useAuth();
  return <div data-testid="out">{`${status}:${isAuthenticated}:${user?.username ?? ''}`}</div>;
}

const USER = {
  id: 'u1',
  email: 'a@b.com',
  username: 'ab',
  displayName: null,
  emailVerified: false,
  createdAt: '2020-01-01T00:00:00.000Z',
};

describe('AuthProvider', () => {
  it('settles to unauthenticated when session restore fails', async () => {
    const fetchMock = vi.fn(async () =>
      json(401, { error: { code: 'UNAUTHORIZED', message: 'no session' } }),
    ) as unknown as typeof fetch;

    render(
      <AuthProvider config={{ baseUrl: 'https://api.test', fetch: fetchMock }}>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('out').textContent).toBe('unauthenticated:false:'),
    );
  });

  it('becomes authenticated when the session restores', async () => {
    const fetchMock = vi.fn(async () =>
      json(200, { user: USER, roles: ['customer'], permissions: ['x'] }),
    ) as unknown as typeof fetch;

    render(
      <AuthProvider config={{ baseUrl: 'https://api.test', fetch: fetchMock }}>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('out').textContent).toBe('authenticated:true:ab'));
  });
});
