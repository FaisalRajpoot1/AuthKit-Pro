import type { Request, Response } from 'express';
import { recordAudit } from '../audit/audit.service';
import type { RequestContext } from '../auth/auth.types';
import * as service from './sessions.service';

function getContext(req: Request): RequestContext {
  return { userAgent: req.headers['user-agent'], ipAddress: req.ip };
}

export async function listSessions(req: Request, res: Response): Promise<void> {
  const sessions = await service.listSessions(req.user!.id, req.user!.sessionId);
  res.status(200).json({ sessions });
}

export async function revokeSession(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  await service.revokeUserSession(req.user!.id, id);
  await recordAudit({
    action: 'SESSION_REVOKED',
    userId: req.user!.id,
    context: getContext(req),
    metadata: { sessionId: id },
  });
  res.status(204).send();
}

/** Logs out every other device, keeping the caller's current session. */
export async function revokeOtherSessions(req: Request, res: Response): Promise<void> {
  const count = await service.revokeAllUserSessions(req.user!.id, req.user!.sessionId);
  await recordAudit({
    action: 'ALL_SESSIONS_REVOKED',
    userId: req.user!.id,
    context: getContext(req),
    metadata: { revokedCount: count },
  });
  res.status(200).json({ revokedCount: count });
}
