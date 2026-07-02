import type { User } from '@prisma/client';
import { emailService } from '../../lib/email/email.service';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { notify } from '../notifications/notifications.service';
import type { RequestContext } from './auth.types';

/**
 * Detects a sign-in from a device/location the user hasn't used before and, if
 * so, sends a security alert (email + in-app). Best-effort: never blocks login.
 *
 * Call this BEFORE recording the current successful login attempt, so the check
 * only considers prior history. A user's very first successful login is not
 * flagged (there's no baseline to compare against).
 */
export async function checkSuspiciousLogin(user: User, context: RequestContext): Promise<void> {
  try {
    const priorSuccesses = await prisma.loginAttempt.count({
      where: { userId: user.id, successful: true },
    });
    if (priorSuccesses === 0) {
      return; // First successful login — nothing to compare against.
    }

    const ip = context.ipAddress ?? null;
    const ua = context.userAgent ?? null;
    const matchers = [
      ...(ip ? [{ ipAddress: ip }] : []),
      ...(ua ? [{ userAgent: ua }] : []),
    ];
    // If we have no signal at all, don't guess.
    if (matchers.length === 0) return;

    const seenBefore = await prisma.loginAttempt.count({
      where: { userId: user.id, successful: true, OR: matchers },
    });
    if (seenBefore > 0) {
      return; // Known device/IP.
    }

    const when = new Date().toISOString();
    await emailService.sendSuspiciousLoginEmail(user.email, {
      ipAddress: ip,
      userAgent: ua,
      when,
    });
    await notify(user.id, {
      type: 'SECURITY_ALERT',
      title: 'New sign-in to your account',
      body: `A new sign-in was detected${ip ? ` from ${ip}` : ''}. If this wasn't you, change your password.`,
    });
    logger.info({ userId: user.id }, 'Suspicious login alert sent');
  } catch (error) {
    logger.error({ err: error, userId: user.id }, 'Suspicious-login check failed');
  }
}
