import { logger } from './logger';

/**
 * CAPTCHA verification against a provider's siteverify endpoint. Supports
 * Cloudflare Turnstile, hCaptcha, and Google reCAPTCHA — all share the same
 * `{ secret, response, remoteip }` form contract and return `{ success }`.
 *
 * Fails OPEN (returns true) when the provider is unreachable, so an outage of
 * the CAPTCHA service can't lock users out of registration/login. An explicit
 * `success: false` still fails closed.
 */
export type CaptchaProvider = 'turnstile' | 'hcaptcha' | 'recaptcha';

const ENDPOINTS: Record<CaptchaProvider, string> = {
  turnstile: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
  hcaptcha: 'https://hcaptcha.com/siteverify',
  recaptcha: 'https://www.google.com/recaptcha/api/siteverify',
};

interface SiteVerifyResponse {
  success?: boolean;
}

export async function verifyCaptchaToken(
  token: string,
  options: { provider: CaptchaProvider; secret: string; remoteIp?: string | undefined },
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<boolean> {
  const body = new URLSearchParams({ secret: options.secret, response: token });
  if (options.remoteIp) body.set('remoteip', options.remoteIp);

  try {
    const response = await fetchImpl(ENDPOINTS[options.provider], {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!response.ok) {
      logger.warn({ status: response.status }, 'CAPTCHA provider error — allowing request');
      return true;
    }
    const data = (await response.json()) as SiteVerifyResponse;
    return data.success === true;
  } catch (error) {
    logger.warn({ err: error }, 'CAPTCHA verification unavailable — allowing request');
    return true;
  }
}
