import { logger } from '../../logger';
import type { EmailMessage, EmailTransport } from '../email.types';

/**
 * Development transport. Instead of sending, it logs the message (including any
 * action links) so local auth flows can be completed without a mailserver.
 */
export class ConsoleEmailTransport implements EmailTransport {
  readonly name = 'console';

  send(message: EmailMessage): Promise<void> {
    logger.info(
      { to: message.to, subject: message.subject, body: message.text },
      '📧 [console email] (not actually sent)',
    );
    return Promise.resolve();
  }
}
