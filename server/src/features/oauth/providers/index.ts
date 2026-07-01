import { OAuthProvider } from '@prisma/client';
import { NotFoundError } from '../../../utils/errors';
import type { OAuthProviderClient } from '../oauth.types';
import { discordProvider } from './discord.provider';
import { facebookProvider } from './facebook.provider';
import { githubProvider } from './github.provider';
import { googleProvider } from './google.provider';
import { linkedinProvider } from './linkedin.provider';
import { microsoftProvider } from './microsoft.provider';

const PROVIDERS: Record<OAuthProvider, OAuthProviderClient> = {
  GOOGLE: googleProvider,
  GITHUB: githubProvider,
  MICROSOFT: microsoftProvider,
  DISCORD: discordProvider,
  FACEBOOK: facebookProvider,
  LINKEDIN: linkedinProvider,
};

/** Parses a URL slug into a known provider enum, or throws 404. */
export function parseProvider(slug: string): OAuthProvider {
  const upper = slug.toUpperCase();
  if (upper in OAuthProvider) {
    return upper as OAuthProvider;
  }
  throw new NotFoundError(`Unknown OAuth provider: ${slug}`);
}

export function getProviderClient(provider: OAuthProvider): OAuthProviderClient {
  return PROVIDERS[provider];
}

/** Names of providers that are configured and available for use. */
export function configuredProviders(): OAuthProvider[] {
  return (Object.keys(PROVIDERS) as OAuthProvider[]).filter((name) =>
    PROVIDERS[name].isConfigured(),
  );
}
