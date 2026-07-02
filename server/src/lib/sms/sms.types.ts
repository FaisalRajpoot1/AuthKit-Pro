/** A short text message to deliver to a phone number. */
export interface SmsMessage {
  to: string;
  body: string;
}

/** Pluggable SMS delivery mechanism (console for dev, Twilio for prod). */
export interface SmsTransport {
  readonly name: string;
  send(message: SmsMessage): Promise<void>;
}
