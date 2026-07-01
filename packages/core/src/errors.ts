/**
 * Error thrown for any non-2xx API response. Carries the HTTP status and the
 * server's stable machine-readable `code` so callers can branch without parsing
 * human-readable messages.
 */
export class AuthKitError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AuthKitError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** True for authentication failures (expired/invalid credentials or token). */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}
