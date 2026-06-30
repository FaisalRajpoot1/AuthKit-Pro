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
import type { LoginFormValues, RegisterFormValues, User } from './auth.types';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  login: (values: LoginFormValues) => Promise<void>;
  register: (values: RegisterFormValues) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Provides authentication state to the app. On mount it attempts to restore a
 * session: `fetchMe` 401s without an access token, the API client silently
 * refreshes using the httpOnly cookie, and the retry succeeds if the session
 * is still valid.
 */
export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    let active = true;
    authApi
      .fetchMe()
      .then((restored) => {
        if (active) setUser(restored);
      })
      .catch(() => {
        // No valid session — remain logged out.
      })
      .finally(() => {
        if (active) setIsInitializing(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (values: LoginFormValues) => {
    const { user: loggedIn } = await authApi.login(values);
    setUser(loggedIn);
  }, []);

  const register = useCallback(async (values: RegisterFormValues) => {
    const { user: registered } = await authApi.register(values);
    setUser(registered);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isInitializing,
      login,
      register,
      logout,
    }),
    [user, isInitializing, login, register, logout],
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
