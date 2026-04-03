/**
 * Startup Self-Test
 *
 * Validates that the runtime environment is properly configured before
 * the server begins accepting requests.
 */

import type { GitAdapter } from './git/types.js';

export interface StartupCheckResult {
  passed: boolean;
  checks: Array<{
    name: string;
    passed: boolean;
    message: string;
  }>;
}

/**
 * Run all startup validation checks and return a consolidated result.
 */
export async function runStartupChecks(
  adapter: GitAdapter,
  mode: string,
): Promise<StartupCheckResult> {
  const checks: StartupCheckResult['checks'] = [];

  // 1. Required env vars based on mode
  checks.push(checkEnvVars(mode));

  // 2. Git connectivity — can we list branches?
  checks.push(await checkGitConnectivity(adapter));

  // 3. File read permissions — can we read at least one known file?
  checks.push(await checkFileRead(adapter));

  // 4. Repo conformance — does the repo have ROADMAP.md or specs/?
  checks.push(await checkRepoConformance(adapter));

  // 5. Push credential check (when push mode is enabled)
  checks.push(checkPushCredentials(mode));

  const passed = checks.every((c) => c.passed);
  return { passed, checks };
}

/**
 * Verify that required environment variables are set for the given mode.
 */
function checkEnvVars(mode: string): StartupCheckResult['checks'][number] {
  const missing: string[] = [];

  if (!mode) {
    missing.push('WHEATLEY_MODE');
  }

  if (mode === 'local') {
    if (!process.env.WHEATLEY_REPO_PATH) {
      missing.push('WHEATLEY_REPO_PATH');
    }
  }

  if (missing.length > 0) {
    return {
      name: 'env-vars',
      passed: false,
      message: `Missing required environment variables: ${missing.join(', ')}`,
    };
  }

  return {
    name: 'env-vars',
    passed: true,
    message: `Mode "${mode}" environment variables are set`,
  };
}

/**
 * Verify that the git adapter can list branches (proves connectivity).
 */
async function checkGitConnectivity(
  adapter: GitAdapter,
): Promise<StartupCheckResult['checks'][number]> {
  try {
    const branches = await adapter.listBranches();
    if (branches.length === 0) {
      return {
        name: 'git-connectivity',
        passed: false,
        message: 'Git adapter returned zero branches',
      };
    }
    return {
      name: 'git-connectivity',
      passed: true,
      message: `Git connectivity OK — ${branches.length} branch(es) found`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      name: 'git-connectivity',
      passed: false,
      message: `Git connectivity failed: ${msg}`,
    };
  }
}

/**
 * Verify that we can read a file from the repository.
 */
async function checkFileRead(
  adapter: GitAdapter,
): Promise<StartupCheckResult['checks'][number]> {
  try {
    // Try ROADMAP.md first, then README.md as a fallback
    const candidates = ['ROADMAP.md', 'README.md'];
    for (const file of candidates) {
      const content = await adapter.readFile(file);
      if (content !== null) {
        return {
          name: 'file-read',
          passed: true,
          message: `Successfully read ${file} (${content.length} bytes)`,
        };
      }
    }
    return {
      name: 'file-read',
      passed: false,
      message: 'Could not read ROADMAP.md or README.md from the repository',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      name: 'file-read',
      passed: false,
      message: `File read check failed: ${msg}`,
    };
  }
}

/**
 * Verify that the repository conforms to expected structure
 * (has ROADMAP.md or a specs/ directory).
 */
/**
 * When push mode is enabled, verify that credentials are available.
 * Only applies to local mode with WHEATLEY_PUSH_ON_WRITE=true.
 */
function checkPushCredentials(mode: string): StartupCheckResult['checks'][number] {
  const pushOnWrite = process.env.WHEATLEY_PUSH_ON_WRITE === 'true';

  if (!pushOnWrite) {
    return {
      name: 'push-credentials',
      passed: true,
      message: 'Push disabled (commit-only mode) — no credentials required',
    };
  }

  // Check for at least one credential source
  const hasGitHubToken = !!process.env.GITHUB_TOKEN;
  const hasGitLabToken = !!process.env.GITLAB_TOKEN;
  const hasCredUrl = !!process.env.GIT_CREDENTIALS_URL;
  const hasSshKey = !!process.env.SSH_AUTH_SOCK || !!process.env.SSH_KEY_PATH;

  if (hasGitHubToken || hasGitLabToken || hasCredUrl || hasSshKey) {
    const source = hasGitHubToken ? 'GITHUB_TOKEN' :
      hasGitLabToken ? 'GITLAB_TOKEN' :
      hasCredUrl ? 'GIT_CREDENTIALS_URL' : 'SSH agent';
    return {
      name: 'push-credentials',
      passed: true,
      message: `Push enabled — credential source: ${source}`,
    };
  }

  return {
    name: 'push-credentials',
    passed: false,
    message: 'Push enabled (WHEATLEY_PUSH_ON_WRITE=true) but no credentials found. ' +
      'Set GITHUB_TOKEN, GITLAB_TOKEN, GIT_CREDENTIALS_URL, or mount SSH keys.',
  };
}

async function checkRepoConformance(
  adapter: GitAdapter,
): Promise<StartupCheckResult['checks'][number]> {
  try {
    // Check for ROADMAP.md
    const roadmap = await adapter.readFile('ROADMAP.md');
    if (roadmap !== null) {
      return {
        name: 'repo-conformance',
        passed: true,
        message: 'Repository has ROADMAP.md',
      };
    }

    // Check for specs/ directory
    const specsEntries = await adapter.listDirectory('specs');
    if (specsEntries.length > 0) {
      return {
        name: 'repo-conformance',
        passed: true,
        message: `Repository has specs/ directory (${specsEntries.length} entries)`,
      };
    }

    return {
      name: 'repo-conformance',
      passed: false,
      message: 'Repository lacks both ROADMAP.md and specs/ — conformance check failed',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      name: 'repo-conformance',
      passed: false,
      message: `Repo conformance check failed: ${msg}`,
    };
  }
}
