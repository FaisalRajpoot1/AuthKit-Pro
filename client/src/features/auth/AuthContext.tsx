import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import * as authApi from './auth.api';
import type { LoginResult, TwoFactorLoginInput } from './auth.api';
import type { LoginFormValues, RegisterFormValues, User } from './auth.types';

interface AuthContextValue {
  user: User | null;
  roles: string[];
  permissions: string[];
  isAuthenticated: boolean;
  isInitializing: boolean;
  hasPermission: (key: string) => boolean;
  hasRole: (name: string) => boolean;
  refresh: () => Promise<void>;
  login: (values: LoginFormValues) => Promise<LoginResult>;
  completeTwoFactor: (input: TwoFactorLoginInput) => Promise<void>;
  register: (values: RegisterFormValues) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Provides authentication + RBAC state. On mount it restores a session: the
 * API client transparently refreshes using the httpOnly cookie, and `/me`
 * returns the user along with their roles and permissions.
 */
export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);

  const loadProfile = useCallback(async () => {
    const profile = await authApi.fetchMe();
    setUser(profile.user);
    setRoles(profile.roles);
    setPermissions(profile.permissions);
  }, []);

  const clear = useCallback(() => {
    setUser(null);
    setRoles([]);
    setPermissions([]);
  }, []);

  useEffect(() => {
    let active = true;
    loadProfile()
      .catch(() => undefined)
      .finally(() => {
        if (active) setIsInitializing(false);
      });
    return () => {
      active = false;
    };
  }, [loadProfile]);

  const login = useCallback(
    async (values: LoginFormValues): Promise<LoginResult> => {
      const result = await authApi.login(values);
      if (result.kind === 'authenticated') {
        await loadProfile();
      }
      return result;
    },
    [loadProfile],
  );

  const completeTwoFactor = useCallback(
    async (input: TwoFactorLoginInput) => {
      await authApi.completeTwoFactorLogin(input);
      await loadProfile();
    },
    [loadProfile],
  );

  const register = useCallback(
    async (values: RegisterFormValues) => {
      await authApi.register(values);
      await loadProfile();
    },
    [loadProfile],
  );

  const logout = useCallback(async () => {
    await authApi.logout();
    clear();
  }, [clear]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      roles,
      permissions,
      isAuthenticated: user !== null,
      isInitializing,
      hasPermission: (key: string) => permissions.includes(key),
      hasRole: (name: string) => roles.includes(name),
      refresh: loadProfile,
      login,
      completeTwoFactor,
      register,
      logout,
    }),
    [user, roles, permissions, isInitializing, loadProfile, login, completeTwoFactor, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
