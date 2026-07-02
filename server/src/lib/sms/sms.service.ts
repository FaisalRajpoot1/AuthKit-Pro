import { env } from '../../config/env';
import { logger } from '../logger';
import type { SmsTransport } from './sms.types';
import { ConsoleSmsTransport } from './transports/console.transport';
import { TwilioSmsTransport } from './transports/twilio.transport';

/** Selects Twilio when fully configured, otherwise logs SMS to the console. */
function createTransport(): SmsTransport {
  if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER) {
    return new TwilioSmsTransport(
      env.TWILIO_ACCOUNT_SID,
      env.TWILIO_AUTH_TOKEN,
      env.TWILIO_FROM_NUMBER,
    );
  }
  logger.warn('Twilio not configured — SMS will be logged to the console, not sent');
  return new ConsoleSmsTransport();
}

const transport = createTransport();

/** High-level SMS API used by the SMS-2FA flow. */
export const smsService = {
  async sendPhoneVerification(to: string, code: string): Promise<void> {
    await transport.send({ to, body: `Your AuthKit Pro phone verification code is ${code}` });
  },

  async sendLoginOtp(to: string, code: string): Promise<void> {
    await transport.send({ to, body: `Your AuthKit Pro sign-in code is ${code}` });
  },
};
