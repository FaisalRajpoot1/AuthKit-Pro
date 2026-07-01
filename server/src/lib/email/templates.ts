import type { EmailMessage } from './email.types';

/** Shared HTML shell so every email has consistent, safe markup. */
function layout(heading: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; background:#f8fafc; padding:24px; color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:16px; padding:32px; border:1px solid #e2e8f0;">
          <tr><td>
            <h1 style="margin:0 0 16px; font-size:20px;">${heading}</h1>
            ${bodyHtml}
            <p style="margin-top:32px; font-size:12px; color:#94a3b8;">AuthKit Pro · If you didn't request this, you can safely ignore this email.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function button(url: string, label: string): string {
  return `<a href="${url}" style="display:inline-block; background:#4f46e5; color:#ffffff; text-decoration:none; padding:12px 20px; border-radius:10px; font-weight:600;">${label}</a>`;
}

export function verifyEmailTemplate(to: string, url: string): EmailMessage {
  return {
    to,
    subject: 'Verify your email address',
    html: layout(
      'Confirm your email',
      `<p>Welcome to AuthKit Pro! Please confirm your email address to activate your account.</p>
       <p style="margin:24px 0;">${button(url, 'Verify email')}</p>
       <p style="font-size:13px; color:#64748b;">Or paste this link into your browser:<br>${url}</p>`,
    ),
    text: `Welcome to AuthKit Pro! Verify your email address:\n\n${url}\n\nIf you didn't sign up, ignore this email.`,
  };
}

export function passwordResetTemplate(to: string, url: string): EmailMessage {
  return {
    to,
    subject: 'Reset your password',
    html: layout(
      'Reset your password',
      `<p>We received a request to reset your password. This link expires shortly.</p>
       <p style="margin:24px 0;">${button(url, 'Reset password')}</p>
       <p style="font-size:13px; color:#64748b;">Or paste this link into your browser:<br>${url}</p>`,
    ),
    text: `Reset your AuthKit Pro password:\n\n${url}\n\nIf you didn't request this, ignore this email.`,
  };
}

export function organizationInviteTemplate(
  to: string,
  organizationName: string,
  url: string,
): EmailMessage {
  return {
    to,
    subject: `You've been invited to join ${organizationName}`,
    html: layout(
      `Join ${organizationName}`,
      `<p>You've been invited to join <strong>${organizationName}</strong> on AuthKit Pro.</p>
       <p style="margin:24px 0;">${button(url, 'Accept invitation')}</p>
       <p style="font-size:13px; color:#64748b;">Or paste this link into your browser:<br>${url}</p>`,
    ),
    text: `You've been invited to join ${organizationName} on AuthKit Pro:\n\n${url}`,
  };
}

export function magicLinkTemplate(to: string, url: string): EmailMessage {
  return {
    to,
    subject: 'Your sign-in link',
    html: layout(
      'Sign in to AuthKit Pro',
      `<p>Click the button below to sign in. This link expires shortly and can be used once.</p>
       <p style="margin:24px 0;">${button(url, 'Sign in')}</p>
       <p style="font-size:13px; color:#64748b;">Or paste this link into your browser:<br>${url}</p>`,
    ),
    text: `Sign in to AuthKit Pro:\n\n${url}\n\nIf you didn't request this, ignore this email.`,
  };
}

export function loginOtpTemplate(to: string, code: string): EmailMessage {
  return {
    to,
    subject: 'Your sign-in code',
    html: layout(
      'Your sign-in code',
      `<p>Use this code to sign in. It expires shortly.</p>
       <p style="margin:24px 0; font-size:28px; font-weight:700; letter-spacing:6px;">${code}</p>
       <p style="font-size:13px; color:#64748b;">If you didn't request this, ignore this email.</p>`,
    ),
    text: `Your AuthKit Pro sign-in code is: ${code}\n\nIt expires shortly.`,
  };
}

export function emailChangeTemplate(to: string, url: string): EmailMessage {
  return {
    to,
    subject: 'Confirm your new email address',
    html: layout(
      'Confirm your new email',
      `<p>Confirm this address to finish updating the email on your AuthKit Pro account.</p>
       <p style="margin:24px 0;">${button(url, 'Confirm email')}</p>
       <p style="font-size:13px; color:#64748b;">Or paste this link into your browser:<br>${url}</p>`,
    ),
    text: `Confirm your new AuthKit Pro email address:\n\n${url}`,
  };
}
