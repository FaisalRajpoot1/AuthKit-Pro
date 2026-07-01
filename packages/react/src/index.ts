export { AuthProvider } from './AuthProvider.js';
export { useAuth, useUser } from './hooks.js';
export { ProtectedRoute } from './ProtectedRoute.js';
export type { AuthContextValue, AuthStatus } from './context.js';

// Re-export the core SDK surface for convenience.
export { AuthKit, AuthKitError } from '@authkit/core';
export type {
  AuthKitConfig,
  AuthSession,
  LoginInput,
  LoginResult,
  Profile,
  RegisterInput,
  TwoFactorLoginInput,
  User,
} from '@authkit/core';
