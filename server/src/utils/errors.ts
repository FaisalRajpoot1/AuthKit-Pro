/**
 * Application error hierarchy. Every operational error carries an HTTP status
 * and a stable machine-readable `code` so clients can branch without parsing
 * human messages. The global error handler renders these consistently.
 */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'TOO_MANY_REQUESTS'
  | 'INTERNAL_ERROR';

export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: ErrorCode;
  /** Operational errors are expected; non-operational ones indicate bugs. */
  readonly isOperational = true;
  readonly details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly code = 'VALIDATION_ERROR' as const;
}

export class UnauthorizedError extends AppError {
  readonly statusCode = 401;
  readonly code = 'UNAUTHORIZED' as const;

  constructor(message = 'Authentication required', details?: unknown) {
    super(message, details);
  }
}

export class ForbiddenError extends AppError {
  readonly statusCode = 403;
  readonly code = 'FORBIDDEN' as const;

  constructor(message = 'You do not have permission to perform this action', details?: unknown) {
    super(message, details);
  }
}

export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code = 'NOT_FOUND' as const;

  constructor(message = 'Resource not found', details?: unknown) {
    super(message, details);
  }
}

export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly code = 'CONFLICT' as const;
}

export class TooManyRequestsError extends AppError {
  readonly statusCode = 429;
  readonly code = 'TOO_MANY_REQUESTS' as const;

  constructor(message = 'Too many requests', details?: unknown) {
    super(message, details);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
