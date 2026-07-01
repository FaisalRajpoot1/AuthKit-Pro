import type { ErrorRequestHandler } from 'express';

/** Error carrying an HTTP status and a stable machine-readable code. */
export class AuthError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Optional error handler that renders {@link AuthError}s as JSON. Register it
 * after your routes; other errors are passed through untouched.
 */
export const authErrorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (err instanceof AuthError) {
    res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    return;
  }
  next(err);
};
