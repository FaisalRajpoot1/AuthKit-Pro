import type { Server } from 'node:http';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { closeRedis } from './lib/redis';

/** Composition root: start the HTTP server and wire graceful shutdown. */
async function bootstrap(): Promise<void> {
  // Verify the database connection before accepting traffic.
  await prisma.$connect();
  logger.info('Database connection established');

  const app = createApp();
  const server: Server = app.listen(env.PORT, () => {
    logger.info(`🚀 AuthKit Pro API listening on http://localhost:${env.PORT}`);
  });

  setupGracefulShutdown(server);
}

function setupGracefulShutdown(server: Server): void {
  const shutdown = (signal: string): void => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(() => {
      void Promise.allSettled([prisma.$disconnect(), closeRedis()]).finally(() => {
        logger.info('Shutdown complete');
        process.exit(0);
      });
    });

    // Force-exit if cleanup hangs.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((error) => {
  logger.error({ err: error }, 'Fatal error during startup');
  process.exit(1);
});
