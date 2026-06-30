import type { RequestHandler } from 'express';
import type { ZodTypeAny, z } from 'zod';

/**
 * Builds a middleware that validates and replaces `req.body` with parsed,
 * typed data. Invalid input throws a ZodError handled by the error middleware.
 * Keeping validation at the edge means services receive trusted, typed input.
 */
export function validateBody<TSchema extends ZodTypeAny>(schema: TSchema): RequestHandler {
  return (req, _res, next) => {
    const parsed = schema.parse(req.body);
    req.body = parsed as z.infer<TSchema>;
    next();
  };
}
