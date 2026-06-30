import pino, { type LoggerOptions } from 'pino';
import { env, isProduction } from '../config/env';

/**
 * Structured application logger. JSON in production for log aggregation,
 * pretty-printed in development for readability.
 */
const options: LoggerOptions = {
  level: env.NODE_ENV === 'test' ? 'silent' : isProduction ? 'info' : 'debug',
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.passwordHash'],
    remove: true,
  },
};

// Pretty transport only outside production; production emits raw JSON.
if (!isProduction) {
  options.transport = {
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
  };
}

export const logger = pino(options);

export type Logger = typeof logger;
