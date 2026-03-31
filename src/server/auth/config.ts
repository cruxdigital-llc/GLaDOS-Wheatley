/**
 * Auth Config Loader
 *
 * Loads auth configuration from environment variables.
 * In local mode, JWT secret is auto-generated and auth is effectively disabled.
 * In cloud mode, WHEATLEY_JWT_SECRET is required.
 */

import { randomBytes } from 'node:crypto';
import type { AuthConfig } from './types.js';

let generatedSecret: string | undefined;

export function loadAuthConfig(): AuthConfig {
  const hasCloudAuth = !!(process.env['WHEATLEY_JWT_SECRET'] || process.env['GITHUB_CLIENT_ID'] || process.env['GITLAB_CLIENT_ID']);
  const mode: AuthConfig['mode'] = hasCloudAuth ? 'cloud' : 'local';

  let jwtSecret = process.env['WHEATLEY_JWT_SECRET'];
  if (!jwtSecret) {
    if (mode === 'cloud') {
      throw new Error(
        'WHEATLEY_JWT_SECRET is required in cloud mode. Set a strong random string.',
      );
    }
    // Local mode: auto-generate a per-process secret
    if (!generatedSecret) {
      generatedSecret = randomBytes(32).toString('hex');
    }
    jwtSecret = generatedSecret;
  }

  const rawExpiry = process.env['WHEATLEY_JWT_EXPIRY'] ?? '86400';
  const jwtExpirySeconds = parseInt(rawExpiry, 10);
  if (isNaN(jwtExpirySeconds) || jwtExpirySeconds <= 0) {
    throw new Error(
      `WHEATLEY_JWT_EXPIRY must be a positive integer (seconds), got "${rawExpiry}"`,
    );
  }

  const apiKey = process.env['WHEATLEY_API_KEY'] || undefined;

  // Auto-detect GitHub OAuth
  const githubClientId = process.env['GITHUB_CLIENT_ID'];
  const githubClientSecret = process.env['GITHUB_CLIENT_SECRET'];
  const githubCallbackUrl = process.env['GITHUB_OAUTH_CALLBACK'];
  const github =
    githubClientId && githubClientSecret && githubCallbackUrl
      ? { clientId: githubClientId, clientSecret: githubClientSecret, callbackUrl: githubCallbackUrl }
      : undefined;

  if (githubClientId && !github) {
    console.warn(
      'WARNING: GITHUB_CLIENT_ID is set but GitHub OAuth is incomplete. Also set GITHUB_CLIENT_SECRET and GITHUB_OAUTH_CALLBACK.',
    );
  }

  // Auto-detect GitLab OAuth
  const gitlabClientId = process.env['GITLAB_CLIENT_ID'];
  const gitlabClientSecret = process.env['GITLAB_CLIENT_SECRET'];
  const gitlabCallbackUrl = process.env['GITLAB_OAUTH_CALLBACK'];
  const gitlabBaseUrl = process.env['GITLAB_BASE_URL'] ?? 'https://gitlab.com';
  const gitlab =
    gitlabClientId && gitlabClientSecret && gitlabCallbackUrl
      ? { clientId: gitlabClientId, clientSecret: gitlabClientSecret, callbackUrl: gitlabCallbackUrl, baseUrl: gitlabBaseUrl }
      : undefined;

  if (gitlabClientId && !gitlab) {
    console.warn(
      'WARNING: GITLAB_CLIENT_ID is set but GitLab OAuth is incomplete. Also set GITLAB_CLIENT_SECRET and GITLAB_OAUTH_CALLBACK.',
    );
  }

  if (mode === 'cloud' && !github && !gitlab && !apiKey) {
    throw new Error(
      'Cloud mode requires at least one authentication method. ' +
      'Configure a complete OAuth provider (GITHUB_CLIENT_ID + GITHUB_CLIENT_SECRET + GITHUB_OAUTH_CALLBACK, ' +
      'or GITLAB_CLIENT_ID + GITLAB_CLIENT_SECRET + GITLAB_OAUTH_CALLBACK) ' +
      'or set WHEATLEY_API_KEY.',
    );
  }

  return {
    mode,
    jwtSecret,
    jwtExpirySeconds,
    apiKey,
    github,
    gitlab,
  };
}
