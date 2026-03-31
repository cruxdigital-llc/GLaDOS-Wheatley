/**
 * Git Adapter Factory
 *
 * Creates the appropriate GitAdapter based on configuration.
 * Selection is driven by WHEATLEY_MODE environment variable.
 */

import type { GitAdapter, GitAdapterConfig } from './types.js';
import { LocalGitAdapter } from './local-adapter.js';
import { RemoteGitAdapter } from './remote-adapter.js';

/**
 * Create a GitAdapter instance based on the provided configuration.
 * Throws if required config is missing for the selected mode.
 */
export function createGitAdapter(config: GitAdapterConfig): GitAdapter {
  switch (config.mode) {
    case 'local': {
      if (!config.localPath) {
        throw new Error(
          'LocalGitAdapter requires config.localPath — set WHEATLEY_REPO_PATH environment variable',
        );
      }
      return new LocalGitAdapter(config.localPath);
    }

    case 'remote': {
      if (!config.github) {
        throw new Error(
          'RemoteGitAdapter requires config.github — set GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO environment variables',
        );
      }
      const { token, owner, repo } = config.github;
      if (!token || !owner || !repo) {
        throw new Error(
          'RemoteGitAdapter requires github.token, github.owner, and github.repo',
        );
      }
      return new RemoteGitAdapter(config.github);
    }

    default:
      throw new Error(
        `Invalid WHEATLEY_MODE: "${String(config.mode)}". Must be "local" or "remote".`,
      );
  }
}

/**
 * Create a GitAdapterConfig from environment variables.
 */
export function configFromEnv(): GitAdapterConfig {
  const mode = process.env.WHEATLEY_MODE as 'local' | 'remote' | undefined;

  if (!mode || (mode !== 'local' && mode !== 'remote')) {
    throw new Error(
      `WHEATLEY_MODE must be "local" or "remote", got "${String(mode)}"`,
    );
  }

  return {
    mode,
    localPath: process.env.WHEATLEY_REPO_PATH,
    github: process.env.GITHUB_TOKEN
      ? {
          token: process.env.GITHUB_TOKEN,
          owner: process.env.GITHUB_OWNER ?? '',
          repo: process.env.GITHUB_REPO ?? '',
        }
      : undefined,
  };
}
