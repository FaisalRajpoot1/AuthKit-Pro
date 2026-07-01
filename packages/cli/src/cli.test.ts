import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildEnvFile } from './env';
import { runInit, type Logger } from './commands/init';
import { generateSecrets } from './secrets';
import { main } from './cli';

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'authkit-cli-'));
}

const silentLogger: Logger = { log: () => undefined, error: () => undefined };

describe('generateSecrets', () => {
  it('creates a 32-byte encryption key and distinct JWT secrets', () => {
    const s = generateSecrets();
    expect(Buffer.from(s.encryptionKey, 'base64')).toHaveLength(32);
    expect(s.jwtAccessSecret).not.toEqual(s.jwtRefreshSecret);
    expect(s.jwtAccessSecret.length).toBeGreaterThan(40);
  });
});

describe('buildEnvFile', () => {
  it('embeds the secrets and a provided DATABASE_URL', () => {
    const secrets = generateSecrets();
    const env = buildEnvFile({ secrets, databaseUrl: 'postgresql://u:p@h:5432/db' });
    expect(env).toContain(`JWT_ACCESS_SECRET=${secrets.jwtAccessSecret}`);
    expect(env).toContain(`ENCRYPTION_KEY=${secrets.encryptionKey}`);
    expect(env).toContain('DATABASE_URL=postgresql://u:p@h:5432/db');
  });
});

describe('runInit', () => {
  let dir: string;
  beforeEach(() => {
    dir = tempDir();
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('creates a .env with secrets', () => {
    const result = runInit({ cwd: dir }, silentLogger);
    expect(result.created).toBe(true);
    const content = readFileSync(result.path, 'utf8');
    expect(content).toContain('JWT_ACCESS_SECRET=');
    expect(content).toContain('ENCRYPTION_KEY=');
  });

  it('refuses to overwrite without --force', () => {
    runInit({ cwd: dir }, silentLogger);
    const second = runInit({ cwd: dir }, silentLogger);
    expect(second.created).toBe(false);
  });

  it('overwrites with force', () => {
    runInit({ cwd: dir }, silentLogger);
    const forced = runInit({ cwd: dir, force: true }, silentLogger);
    expect(forced.created).toBe(true);
  });
});

describe('main', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 0 for `version`', () => {
    expect(main(['version'])).toBe(0);
  });

  it('returns 1 for an unknown command', () => {
    expect(main(['frobnicate'])).toBe(1);
  });

  it('returns 0 for `secret` and prints a value', () => {
    expect(main(['secret'])).toBe(0);
    expect(console.log).toHaveBeenCalled();
  });

  it('scaffolds via `init --cwd`', () => {
    const dir = tempDir();
    try {
      expect(main(['init', '--cwd', dir])).toBe(0);
      expect(readFileSync(join(dir, '.env'), 'utf8')).toContain('JWT_ACCESS_SECRET=');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
