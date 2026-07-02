import { env } from '../../config/env';
import { logger } from '../logger';
import type { EmailMessage, EmailTransport } from './email.types';
import { ConsoleEmailTransport } from './transports/console.transport';
import { SmtpEmailTransport } from './transports/smtp.transport';

/** Selects SMTP when configured, otherwise logs emails to the console. */
function createTransport(): EmailTransport {
  if (env.SMTP_HOST) {
    return new SmtpEmailTransport(env.SMTP_HOST);
  }
  logger.warn('SMTP_HOST not set — emails will be logged to the console, not sent');
  return new ConsoleEmailTransport();
}

const transport = createTransport();

/** Name of the active transport (e.g. "smtp" or "console"). */
export const emailTransportName = transport.name;

/**
 * Sends a message through the active transport immediately (no queue). Used both
 * as the inline path (no Redis) and by the background worker that drains the
 * email queue when Redis is configured.
 */
export function sendEmailNow(message: EmailMessage): Promise<void> {
  return transport.send(message);
}
