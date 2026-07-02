import { logger } from '../../logger';
import type { SmsMessage, SmsTransport } from '../sms.types';

/**
 * Development transport. Instead of sending, it logs the message (including the
 * code) so local SMS-2FA flows can be completed without a Twilio account.
 */
export class ConsoleSmsTransport implements SmsTransport {
  readonly name = 'console';

  send(message: SmsMessage): Promise<void> {
    logger.info(
      { to: message.to, body: message.body },
      '📱 [console sms] (not actually sent)',
    );
    return Promise.resolve();
  }
}
