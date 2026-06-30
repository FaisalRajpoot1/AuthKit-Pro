/** A renderable email message. */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Pluggable delivery mechanism (console for dev, SMTP for prod). */
export interface EmailTransport {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}
