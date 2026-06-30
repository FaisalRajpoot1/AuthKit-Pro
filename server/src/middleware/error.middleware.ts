import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { isProduction } from '../config/env';
import { logger } from '../lib/logger';
import { AppError, isAppError } from '../utils/errors';

/** Catch-all 404 for unmatched routes. */
export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
  });
};

interface ErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

function normalize(error: unknown): { status: number; body: ErrorBody } {
  if (error instanceof ZodError) {
    return {
      status: 400,
      body: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: error.flatten(),
      },
    };
  }

  if (isAppError(error)) {
    const app = error as AppError;
    return {
      status: app.statusCode,
      body: { code: app.code, message: app.message, details: app.details },
    };
  }

  // Unique-constraint violations surface as a 409 without leaking internals.
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return {
      status: 409,
      body: { code: 'CONFLICT', message: 'A record with these details already exists' },
    };
  }

  return {
    status: 500,
    body: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  };
}

/** Global error handler. Must be registered last, after all routes. */
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const { status, body } = normalize(error);

  if (status >= 500) {
    logger.error({ err: error }, 'Unhandled error');
  } else {
    logger.warn({ code: body.code, message: body.message }, 'Request error');
  }

  // Never leak internal details in production for 5xx errors.
  if (status >= 500 && isProduction) {
    delete body.details;
  }

  res.status(status).json({ error: body });
};
