import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildEnvFile } from '../env';
import { generateSecrets } from '../secrets';

export interface Logger {
  log: (message: string) => void;
  error: (message: string) => void;
}

export interface InitOptions {
  cwd?: string;
  force?: boolean;
  databaseUrl?: string;
}

export interface InitResult {
  path: string;
  created: boolean;
}

/**
 * Scaffolds a server `.env` with freshly generated secrets. Refuses to
 * overwrite an existing file unless `force` is set.
 */
export function runInit(options: InitOptions = {}, logger: Logger = console): InitResult {
  const cwd = options.cwd ?? process.cwd();
  const target = resolve(cwd, '.env');

  if (existsSync(target) && !options.force) {
    logger.error(`✗ .env already exists at ${target}`);
    logger.error('  Use --force to overwrite it.');
    return { path: target, created: false };
  }

  const secrets = generateSecrets();
  const content = buildEnvFile({
    secrets,
    ...(options.databaseUrl ? { databaseUrl: options.databaseUrl } : {}),
  });
  writeFileSync(target, content, { encoding: 'utf8' });

  logger.log(`✓ Wrote ${target}`);
  logger.log('  Generated JWT access/refresh secrets and an encryption key.');
  if (!options.databaseUrl) {
    logger.log('  Set DATABASE_URL in the new .env to point at your PostgreSQL.');
  }
  logger.log('');
  logger.log('Next steps:');
  logger.log('  npm install');
  logger.log('  npm run prisma:migrate   # create tables');
  logger.log('  npm run prisma:seed      # roles & permissions');
  logger.log('  npm run dev              # start the API');

  return { path: target, created: true };
}
