import { Router } from 'express';
import { accountRouter } from '../features/account/account.routes';
import { adminRouter } from '../features/admin/admin.routes';
import { auditRouter } from '../features/audit/audit.routes';
import { authRouter } from '../features/auth/auth.routes';
import { healthRouter } from '../features/health/health.routes';
import { sessionsRouter } from '../features/sessions/sessions.routes';

/** Versioned API router. New feature routers are mounted here. */
export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/account', accountRouter);
apiRouter.use('/sessions', sessionsRouter);
apiRouter.use('/audit-logs', auditRouter);
apiRouter.use('/admin', adminRouter);
