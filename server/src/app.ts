import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { openApiDocument } from './docs/openapi';
import { logger } from './lib/logger';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { ipBlockGuard } from './middleware/ipBlock.middleware';
import { apiRateLimiter } from './middleware/rateLimit.middleware';
import { apiRouter } from './routes';

const API_PREFIX = '/api/v1';

/**
 * Builds and configures the Express application. Kept free of side effects
 * (no listen) so it can be imported directly by integration tests.
 */
export function createApp(): Express {
  const app = express();

  // We sit behind a reverse proxy (Nginx/Render); trust it for correct req.ip
  // and secure-cookie handling.
  app.set('trust proxy', 1);

  // Interactive API docs (mounted before the strict CSP, which would otherwise
  // block Swagger UI's inline assets). Raw spec is also exposed as JSON.
  if (env.API_DOCS_ENABLED) {
    app.get(`${API_PREFIX}/openapi.json`, (_req, res) => {
      res.json(openApiDocument);
    });
    app.use(
      `${API_PREFIX}/docs`,
      helmet({ contentSecurityPolicy: false }),
      swaggerUi.serve,
      swaggerUi.setup(openApiDocument as Parameters<typeof swaggerUi.setup>[0], {
        customSiteTitle: 'AuthKit Pro API',
        customCss: '.swagger-ui .topbar { display: none }',
      }),
    );
  }

  // Security headers.
  app.use(helmet());

  // CORS — allow only configured origins, with credentials for cookie auth.
  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      credentials: true,
    }),
  );

  // Body & cookie parsing.
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));
  app.use(cookieParser());

  // Request logging.
  app.use(pinoHttp({ logger }));

  // Turn away administrator-blocked IPs before any further processing.
  app.use(API_PREFIX, ipBlockGuard);

  // Baseline rate limiting across the API surface.
  app.use(API_PREFIX, apiRateLimiter);

  // Feature routes.
  app.use(API_PREFIX, apiRouter);

  // 404 + centralized error handling (must be last).
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
