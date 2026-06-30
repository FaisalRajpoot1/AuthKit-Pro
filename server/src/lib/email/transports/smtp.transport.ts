import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../../../config/env';
import { logger } from '../../logger';
import type { EmailMessage, EmailTransport } from '../email.types';

/** Production transport backed by SMTP via Nodemailer. */
export class SmtpEmailTransport implements EmailTransport {
  readonly name = 'smtp';
  private readonly transporter: Transporter;

  constructor(host: string) {
    this.transporter = nodemailer.createTransport({
      host,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth:
        env.SMTP_USER && env.SMTP_PASS
          ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
          : undefined,
    });
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: env.EMAIL_FROM,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    logger.debug({ to: message.to, subject: message.subject }, 'Email sent via SMTP');
  }
}
