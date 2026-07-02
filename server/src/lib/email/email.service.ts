import { env } from '../../config/env';
import { dispatchEmail } from '../../jobs/email.queue';
import {
  emailChangeTemplate,
  loginOtpTemplate,
  magicLinkTemplate,
  organizationInviteTemplate,
  passwordResetTemplate,
  verifyEmailTemplate,
} from './templates';

function link(path: string, token: string): string {
  const url = new URL(path, env.APP_URL);
  url.searchParams.set('token', token);
  return url.toString();
}

/**
 * High-level email API used by auth flows. Builds links, renders a template, and
 * hands the message to `dispatchEmail` — which queues it to a background worker
 * when Redis is configured, or sends it inline otherwise.
 */
export const emailService = {
  async sendVerificationEmail(to: string, token: string): Promise<void> {
    await dispatchEmail(verifyEmailTemplate(to, link('/verify-email', token)));
  },

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    await dispatchEmail(passwordResetTemplate(to, link('/reset-password', token)));
  },

  async sendEmailChangeEmail(to: string, token: string): Promise<void> {
    await dispatchEmail(emailChangeTemplate(to, link('/confirm-email-change', token)));
  },

  async sendOrganizationInviteEmail(
    to: string,
    organizationName: string,
    token: string,
  ): Promise<void> {
    await dispatchEmail(
      organizationInviteTemplate(to, organizationName, link('/invites/accept', token)),
    );
  },

  async sendMagicLinkEmail(to: string, token: string): Promise<void> {
    await dispatchEmail(magicLinkTemplate(to, link('/auth/magic', token)));
  },

  async sendLoginOtpEmail(to: string, code: string): Promise<void> {
    await dispatchEmail(loginOtpTemplate(to, code));
  },
};
