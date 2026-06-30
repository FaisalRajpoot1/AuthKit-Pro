import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { asyncHandler } from '../../utils/asyncHandler';

/** Liveness/readiness probes for load balancers and orchestrators. */
export const healthRouter = Router();

// Liveness: process is up.
healthRouter.get('/live', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Readiness: dependencies (database) are reachable.
healthRouter.get(
  '/ready',
  asyncHandler(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ok', database: 'up' });
  }),
);
