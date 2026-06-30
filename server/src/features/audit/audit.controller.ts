import type { Request, Response } from 'express';
import { auditQuerySchema } from './audit.schema';
import * as service from './audit.service';

export async function listMyAuditLogs(req: Request, res: Response): Promise<void> {
  const query = auditQuerySchema.parse(req.query);
  const result = await service.listUserAuditLogs(req.user!.id, query);
  res.status(200).json(result);
}
