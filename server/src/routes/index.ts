import { Router } from 'express';
import { authRouter } from '../features/auth/auth.routes';
import { healthRouter } from '../features/health/health.routes';

/** Versioned API router. New feature routers are mounted here. */
export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
