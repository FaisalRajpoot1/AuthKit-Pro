#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { runInit } from './commands/init';
import { generateSecret } from './secrets';

const VERSION = '0.1.0';

const USAGE = `authkit — AuthKit Pro CLI

Usage:
  authkit init [options]     Scaffold a .env with generated secrets
  authkit secret [--bytes N] Print a single random secret
  authkit help               Show this help
  authkit version            Show the version

init options:
  --force                    Overwrite an existing .env
  --database-url <url>       Set DATABASE_URL in the generated .env
  --cwd <dir>                Target directory (default: current)
`;

/** Runs the CLI and returns a process exit code. */
export function main(argv: string[]): number {
  const [command, ...rest] = argv;

  switch (command) {
    case 'init': {
      const { values } = parseArgs({
        args: rest,
        options: {
          force: { type: 'boolean', default: false },
          'database-url': { type: 'string' },
          cwd: { type: 'string' },
        },
        allowPositionals: false,
      });
      const result = runInit({
        force: values.force,
        ...(values['database-url'] ? { databaseUrl: values['database-url'] } : {}),
        ...(values.cwd ? { cwd: values.cwd } : {}),
      });
      return result.created ? 0 : 1;
    }

    case 'secret': {
      const { values } = parseArgs({
        args: rest,
        options: { bytes: { type: 'string' } },
        allowPositionals: false,
      });
      const bytes = values.bytes ? Number.parseInt(values.bytes, 10) : 48;
      if (!Number.isFinite(bytes) || bytes < 16) {
        console.error('✗ --bytes must be a number >= 16');
        return 1;
      }
      console.log(generateSecret(bytes));
      return 0;
    }

    case 'version':
    case '--version':
    case '-v':
      console.log(VERSION);
      return 0;

    case 'help':
    case '--help':
    case '-h':
    case undefined:
      console.log(USAGE);
      return command === undefined ? 1 : 0;

    default:
      console.error(`✗ Unknown command: ${command}\n`);
      console.error(USAGE);
      return 1;
  }
}

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}
