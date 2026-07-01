import { useContext } from 'react';
import type { User } from '@authkit/core';
import { AuthContext, type AuthContextValue } from './context.js';

/** Access authentication state and actions. Must be used within an AuthProvider. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return context;
}

/** Convenience hook returning just the current user (or null). */
export function useUser(): User | null {
  return useAuth().user;
}
