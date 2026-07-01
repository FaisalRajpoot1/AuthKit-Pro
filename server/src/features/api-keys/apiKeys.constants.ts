/** Scopes an API key can be granted. Kept small and explicit. */
export const API_SCOPES = [
  { key: 'profile:read', description: 'Read your profile' },
  { key: 'sessions:read', description: 'List your active sessions' },
] as const;

export const API_SCOPE_KEYS: readonly string[] = API_SCOPES.map((s) => s.key);

export function isValidScope(scope: string): boolean {
  return API_SCOPE_KEYS.includes(scope);
}
