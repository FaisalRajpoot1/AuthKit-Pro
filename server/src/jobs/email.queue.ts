import { Queue, Worker } from 'bullmq';
import { env } from '../config/env';
import { sendEmailNow } from '../lib/email/email.transport';
import type { EmailMessage } from '../lib/email/email.types';
import { logger } from '../lib/logger';

const QUEUE_NAME = 'email';

/**
 * BullMQ needs its own Redis connection with `maxRetriesPerRequest: null` (it
 * issues blocking commands), so it does not share the rate-limiter's client.
 */
function connection(): { url: string; maxRetriesPerRequest: null } | null {
  if (!env.REDIS_URL) {
    return null;
  }
  return { url: env.REDIS_URL, maxRetriesPerRequest: null };
}

let queue: Queue<EmailMessage> | null = null;
let queueInitialized = false;

/** The email queue, or `null` when Redis is not configured. */
function getEmailQueue(): Queue<EmailMessage> | null {
  if (queueInitialized) {
    return queue;
  }
  queueInitialized = true;

  const conn = connection();
  if (!conn) {
    return null;
  }
  queue = new Queue<EmailMessage>(QUEUE_NAME, {
    connection: conn,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2_000 },
      removeOnComplete: 1_000,
      removeOnFail: 5_000,
    },
  });
  queue.on('error', (err) => logger.warn({ err }, 'Email queue error'));
  return queue;
}

/**
 * Dispatches an email. When Redis is configured the message is queued and sent
 * by a background worker (off the request path, with retries); otherwise it is
 * sent inline so single-instance and test setups behave exactly as before. If
 * enqueue fails, it falls back to an inline send rather than dropping the email.
 */
export async function dispatchEmail(message: EmailMessage): Promise<void> {
  const q = getEmailQueue();
  if (!q) {
    await sendEmailNow(message);
    return;
  }
  try {
    await q.add('send', message);
  } catch (err) {
    logger.warn({ err }, 'Failed to enqueue email; sending inline (fallback)');
    await sendEmailNow(message);
  }
}

let worker: Worker<EmailMessage> | null = null;

/**
 * Starts the background worker that drains the email queue. No-op when Redis is
 * not configured (emails are sent inline instead). Safe to call once at startup.
 */
export function startEmailWorker(): void {
  const conn = connection();
  if (!conn || worker) {
    return;
  }
  worker = new Worker<EmailMessage>(QUEUE_NAME, async (job) => sendEmailNow(job.data), {
    connection: conn,
  });
  worker.on('failed', (job, err) => {
    logger.warn({ err, jobId: job?.id, to: job?.data.to }, 'Email job failed');
  });
  logger.info('Email worker started');
}

/** Closes the queue and worker for graceful shutdown. */
export async function closeEmailJobs(): Promise<void> {
  await Promise.allSettled([queue?.close(), worker?.close()]);
  queue = null;
  worker = null;
  queueInitialized = false;
}
