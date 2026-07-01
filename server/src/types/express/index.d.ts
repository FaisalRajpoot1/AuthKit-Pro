/**
 * Augments Express's Request with the authenticated principal attached by the
 * `requireAuth` middleware. Lets controllers read `req.user` with full typing.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  sessionId: string;
}

/** Principal attached by the API-key middleware (programmatic access). */
export interface ApiKeyPrincipal {
  userId: string;
  scopes: string[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      apiAuth?: ApiKeyPrincipal;
    }
  }
}

export {};
