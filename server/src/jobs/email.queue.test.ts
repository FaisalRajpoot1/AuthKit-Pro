import { describe, expect, it, vi } from 'vitest';
import type { EmailMessage } from '../lib/email/email.types';

// The worker/inline send both go through sendEmailNow; mock it so we can assert
// dispatch behavior without touching a real transport.
vi.mock('../lib/email/email.transport', () => ({
  sendEmailNow: vi.fn(async () => undefined),
  emailTransportName: 'console',
}));

import { sendEmailNow } from '../lib/email/email.transport';
import { dispatchEmail } from './email.queue';

const message: EmailMessage = { to: 'a@b.co', subject: 'Hi', html: '<p>Hi</p>', text: 'Hi' };

describe('dispatchEmail', () => {
  it('sends inline via sendEmailNow when Redis is not configured', async () => {
    // The test env leaves REDIS_URL unset, so there is no queue.
    await dispatchEmail(message);
    expect(sendEmailNow).toHaveBeenCalledWith(message);
  });
});
