import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AuthKit } from '@authkit/core';
import type { AuthKitConfig, LoginInput, LoginResult, RegisterInput, TwoFactorLoginInput, User } from '@authkit/core';
import { AuthContext, type AuthContextValue, type AuthStatus } from './context.js';

type AuthProviderProps = { children: ReactNode } & (
  | { config: AuthKitConfig; client?: never }
  | { client: AuthKit; config?: never }
);

/**
 * Provides authentication state and actions to the tree. On mount it attempts
 * to restore a session via the SDK (which refreshes using the httpOnly cookie),
 * then exposes `useAuth()` to descendants.
 */
export function AuthProvider(props: AuthProviderProps): JSX.Element {
  const client = useMemo(
    () => props.client ?? new AuthKit(props.config as AuthKitConfig),
    [props.client, props.config],
  );

  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);

  const loadProfile = useCallback(async () => {
    try {
      const profile = await client.me();
      setUser(profile.user);
      setRoles(profile.roles);
      setPermissions(profile.permissions);
      setStatus('authenticated');
    } catch {
      setUser(null);
      setRoles([]);
      setPermissions([]);
      setStatus('unauthenticated');
    }
  }, [client]);

  useEffect(() => {
    let active = true;
    void loadProfile().finally(() => {
      if (!active) return;
    });
    return () => {
      active = false;
    };
  }, [loadProfile]);

  const login = useCallback(
    async (input: LoginInput): Promise<LoginResult> => {
      const result = await client.login(input);
      if (result.status === 'authenticated') await loadProfile();
      return result;
    },
    [client, loadProfile],
  );

  const completeTwoFactor = useCallback(
    async (input: TwoFactorLoginInput) => {
      await client.completeTwoFactor(input);
      await loadProfile();
    },
    [client, loadProfile],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      await client.register(input);
      await loadProfile();
    },
    [client, loadProfile],
  );

  const logout = useCallback(async () => {
    await client.logout();
    setUser(null);
    setRoles([]);
    setPermissions([]);
    setStatus('unauthenticated');
  }, [client]);

  const value = useMemo<AuthContextValue>(
    () => ({
      client,
      status,
      user,
      roles,
      permissions,
      isAuthenticated: status === 'authenticated',
      hasPermission: (key: string) => permissions.includes(key),
      hasRole: (name: string) => roles.includes(name),
      login,
      completeTwoFactor,
      register,
      logout,
      refresh: loadProfile,
    }),
    [client, status, user, roles, permissions, login, completeTwoFactor, register, logout, loadProfile],
  );

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>;
}
