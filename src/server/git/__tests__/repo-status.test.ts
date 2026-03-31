/**
 * getRepoStatus() tests
 *
 * Verifies dirty state detection, conflict reporting, and worktree status.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import simpleGit from 'simple-git';
import { LocalGitAdapter } from '../local-adapter.js';

describe('LocalGitAdapter.getRepoStatus()', () => {
  let repoDir: string;
  let adapter: LocalGitAdapter;

  beforeAll(async () => {
    repoDir = await mkdtemp(join(tmpdir(), 'repo-status-'));
    const git = simpleGit(repoDir);
    await git.init();
    await git.addConfig('user.email', 'test@test.com');
    await git.addConfig('user.name', 'Test');

    await mkdir(join(repoDir, 'product-knowledge'), { recursive: true });
    await writeFile(join(repoDir, 'product-knowledge', 'ROADMAP.md'), '# Roadmap\n');
    await git.add('.');
    await git.commit('Initial commit');

    adapter = new LocalGitAdapter(repoDir);
  });

  afterAll(async () => {
    await rm(repoDir, { recursive: true, force: true });
  });

  it('reports clean when working tree is clean', async () => {
    const status = await adapter.getRepoStatus();
    expect(status.clean).toBe(true);
    expect(status.modified).toBe(0);
    expect(status.untracked).toBe(0);
    expect(status.staged).toBe(0);
    expect(status.conflicted).toBe(false);
    expect(status.conflictedFiles).toEqual([]);
    expect(status.worktreeActive).toBe(false);
  });

  it('detects modified files', async () => {
    await writeFile(join(repoDir, 'product-knowledge', 'ROADMAP.md'), '# Updated\n');

    const status = await adapter.getRepoStatus();
    expect(status.clean).toBe(false);
    expect(status.modified).toBeGreaterThanOrEqual(1);

    // Restore
    const git = simpleGit(repoDir);
    await git.checkout(['--', 'product-knowledge/ROADMAP.md']);
  });

  it('detects untracked files', async () => {
    await writeFile(join(repoDir, 'new-file.txt'), 'hello');

    const status = await adapter.getRepoStatus();
    expect(status.clean).toBe(false);
    expect(status.untracked).toBeGreaterThanOrEqual(1);

    // Cleanup
    await rm(join(repoDir, 'new-file.txt'));
  });

  it('detects staged files', async () => {
    await writeFile(join(repoDir, 'staged.txt'), 'staged content');
    const git = simpleGit(repoDir);
    await git.add('staged.txt');

    const status = await adapter.getRepoStatus();
    expect(status.clean).toBe(false);
    expect(status.staged).toBeGreaterThanOrEqual(1);

    // Cleanup
    await git.reset(['staged.txt']);
    await rm(join(repoDir, 'staged.txt'));
  });

  it('detects merge conflicts', async () => {
    const git = simpleGit(repoDir);

    // Create a branch with a change
    await git.checkoutLocalBranch('conflict-branch');
    await writeFile(join(repoDir, 'product-knowledge', 'ROADMAP.md'), '# Branch version\n');
    await git.add('.');
    await git.commit('Branch change');

    // Go back to main and make a conflicting change
    await git.checkout('master').catch(() => git.checkout('main'));
    const mainBranch = (await git.revparse(['--abbrev-ref', 'HEAD'])).trim();
    await writeFile(join(repoDir, 'product-knowledge', 'ROADMAP.md'), '# Main version\n');
    await git.add('.');
    await git.commit('Main change');

    // Try to merge — should produce a conflict
    try {
      await git.merge(['conflict-branch']);
    } catch {
      // Expected — merge conflict
    }

    const status = await adapter.getRepoStatus();
    expect(status.conflicted).toBe(true);
    expect(status.conflictedFiles.length).toBeGreaterThanOrEqual(1);

    // Cleanup: abort merge
    await git.raw(['merge', '--abort']);
    await git.branch(['-D', 'conflict-branch']);
  });
});
