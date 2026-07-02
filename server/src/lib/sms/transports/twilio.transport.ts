import { logger } from '../../logger';
import type { SmsMessage, SmsTransport } from '../sms.types';

/**
 * Production transport backed by Twilio's REST API. Uses the Messages resource
 * directly over fetch (HTTP Basic auth) to avoid pulling in the Twilio SDK.
 */
export class TwilioSmsTransport implements SmsTransport {
  readonly name = 'twilio';
  private readonly endpoint: string;
  private readonly authHeader: string;

  constructor(accountSid: string, authToken: string, private readonly from: string) {
    this.endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    this.authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`;
  }

  async send(message: SmsMessage): Promise<void> {
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: this.authHeader,
      },
      body: new URLSearchParams({ To: message.to, From: this.from, Body: message.body }),
    });
    if (!res.ok) {
      throw new Error(`Twilio SMS failed with status ${res.status}`);
    }
    logger.debug({ to: message.to }, 'SMS sent via Twilio');
  }
}
