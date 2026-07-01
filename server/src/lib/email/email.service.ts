import { env } from '../../config/env';
import { logger } from '../logger';
import type { EmailTransport } from './email.types';
import {
  emailChangeTemplate,
  loginOtpTemplate,
  magicLinkTemplate,
  organizationInviteTemplate,
  passwordResetTemplate,
  verifyEmailTemplate,
} from './templates';
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

function link(path: string, token: string): string {
  const url = new URL(path, env.APP_URL);
  url.searchParams.set('token', token);
  return url.toString();
}

/** High-level email API used by auth flows. Builds links and delegates send. */
export const emailService = {
  async sendVerificationEmail(to: string, token: string): Promise<void> {
    await transport.send(verifyEmailTemplate(to, link('/verify-email', token)));
  },

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    await transport.send(passwordResetTemplate(to, link('/reset-password', token)));
  },

  async sendEmailChangeEmail(to: string, token: string): Promise<void> {
    await transport.send(emailChangeTemplate(to, link('/confirm-email-change', token)));
  },

  async sendOrganizationInviteEmail(
    to: string,
    organizationName: string,
    token: string,
  ): Promise<void> {
    await transport.send(
      organizationInviteTemplate(to, organizationName, link('/invites/accept', token)),
    );
  },

  async sendMagicLinkEmail(to: string, token: string): Promise<void> {
    await transport.send(magicLinkTemplate(to, link('/auth/magic', token)));
  },

  async sendLoginOtpEmail(to: string, code: string): Promise<void> {
    await transport.send(loginOtpTemplate(to, code));
  },
};
