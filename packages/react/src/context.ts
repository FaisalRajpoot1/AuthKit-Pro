import { createContext } from 'react';
import type {
  AuthKit,
  LoginInput,
  LoginResult,
  RegisterInput,
  TwoFactorLoginInput,
  User,
} from '@authkit/core';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

/** Value exposed by {@link useAuth}. */
export interface AuthContextValue {
  /** The underlying SDK client (for advanced use). */
  client: AuthKit;
  status: AuthStatus;
  user: User | null;
  roles: string[];
  permissions: string[];
  isAuthenticated: boolean;
  hasPermission: (key: string) => boolean;
  hasRole: (name: string) => boolean;
  login: (input: LoginInput) => Promise<LoginResult>;
  completeTwoFactor: (input: TwoFactorLoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
