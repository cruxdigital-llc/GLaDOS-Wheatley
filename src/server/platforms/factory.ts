/**
 * Platform Adapter Factory
 *
 * Detects which platform is configured via environment variables
 * and returns the appropriate adapter.
 */

import type { PlatformAdapter } from './types.js';
import { GitHubAdapter } from './github-adapter.js';
import { GitLabAdapter } from './gitlab-adapter.js';
import { NullPlatformAdapter } from './null-adapter.js';

export function createPlatformAdapter(): PlatformAdapter {
  if (process.env['GITHUB_TOKEN'] && process.env['GITHUB_REPOSITORY']) {
    return new GitHubAdapter();
  }
  if (process.env['GITLAB_TOKEN'] && process.env['GITLAB_PROJECT_ID']) {
    return new GitLabAdapter();
  }
  return new NullPlatformAdapter();
}
