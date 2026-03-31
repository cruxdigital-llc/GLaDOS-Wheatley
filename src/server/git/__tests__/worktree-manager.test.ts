/**
 * WorktreeManager tests
 *
 * Tests worktree lifecycle: init, destroy, stale cleanup, fallback.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import simpleGit from 'simple-git';
import { WorktreeManager } from '../worktree-manager.js';

async function pathExists(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

describe('WorktreeManager', () => {
  let repoDir: string;
  let bareDir: string;
  let managers: WorktreeManager[] = [];

  beforeAll(async () => {
    // Create a bare repo as remote
    bareDir = await mkdtemp(join(tmpdir(), 'wt-bare-'));
    const bareGit = simpleGit(bareDir);
    await bareGit.init(['--bare']);

    // Clone into working repo
    repoDir = await mkdtemp(join(tmpdir(), 'wt-repo-'));
    const git = simpleGit(repoDir);
    await git.clone(bareDir, repoDir);
    await git.addConfig('user.email', 'test@test.com');
    await git.addConfig('user.name', 'Test');

    // Initial commit
    await mkdir(join(repoDir, 'product-knowledge'), { recursive: true });
    await writeFile(join(repoDir, 'product-knowledge', 'ROADMAP.md'), '# Roadmap\n');
    await git.add('.');
    await git.commit('Initial commit');

    const branch = (await git.revparse(['--abbrev-ref', 'HEAD'])).trim();
    if (branch !== 'main') {
      await git.branch(['-m', branch, 'main']);
    }
    await git.push('origin', 'main', ['--set-upstream']);
  });

  afterEach(async () => {
    // Destroy all managers created during the test
    for (const m of managers) {
      try { await m.destroy(); } catch { /* ignore */ }
    }
    managers = [];
  });

  afterAll(async () => {
    await rm(bareDir, { recursive: true, force: true });
    await rm(repoDir, { recursive: true, force: true });
  });

  it('creates a worktree on init and reports ready', async () => {
    const mgr = new WorktreeManager({ repoPath: repoDir });
    managers.push(mgr);

    expect(mgr.isReady()).toBe(false);
    await mgr.init();
    expect(mgr.isReady()).toBe(true);
    expect(await pathExists(mgr.getPath())).toBe(true);
  });

  it('getGit returns a usable simple-git instance', async () => {
    const mgr = new WorktreeManager({ repoPath: repoDir });
    managers.push(mgr);
    await mgr.init();

    const wt = mgr.getGit();
    const branch = (await wt.revparse(['--abbrev-ref', 'HEAD'])).trim();
    expect(typeof branch).toBe('string');
  });

  it('getGit throws if not initialized', () => {
    const mgr = new WorktreeManager({ repoPath: repoDir });
    expect(() => mgr.getGit()).toThrow('not initialized');
  });

  it('init is idempotent — calling twice does not error', async () => {
    const mgr = new WorktreeManager({ repoPath: repoDir });
    managers.push(mgr);
    await mgr.init();
    await mgr.init(); // second call should be a no-op
    expect(mgr.isReady()).toBe(true);
  });

  it('destroy removes the worktree', async () => {
    const mgr = new WorktreeManager({ repoPath: repoDir });
    managers.push(mgr);
    await mgr.init();
    const wtPath = mgr.getPath();
    expect(await pathExists(wtPath)).toBe(true);

    await mgr.destroy();
    expect(mgr.isReady()).toBe(false);
    expect(await pathExists(wtPath)).toBe(false);
  });

  it('cleans up stale worktree from previous run', async () => {
    // Create a worktree, then simulate a crash by not calling destroy
    const stalePath = join(repoDir, '.wheatley-worktree');
    const stale = new WorktreeManager({ repoPath: repoDir, worktreePath: stalePath });
    await stale.init();
    // Don't destroy — simulate crash. Just null out the reference.
    expect(await pathExists(stalePath)).toBe(true);

    // New manager should clean up and re-create
    const fresh = new WorktreeManager({ repoPath: repoDir, worktreePath: stalePath });
    managers.push(fresh);
    await fresh.init();
    expect(fresh.isReady()).toBe(true);
    expect(await pathExists(stalePath)).toBe(true);

    // Clean up the stale one's git entry manually
    try {
      const git = simpleGit(repoDir);
      await git.raw(['worktree', 'prune']);
    } catch { /* ignore */ }
  });

  it('supports custom worktree path', async () => {
    const customPath = await mkdtemp(join(tmpdir(), 'wt-custom-'));
    await rm(customPath, { recursive: true, force: true }); // remove so worktree can create it

    const mgr = new WorktreeManager({ repoPath: repoDir, worktreePath: customPath });
    managers.push(mgr);
    await mgr.init();

    expect(mgr.getPath()).toBe(customPath);
    expect(mgr.isReady()).toBe(true);
  });

  it('copies user.name and user.email from main repo', async () => {
    const mgr = new WorktreeManager({ repoPath: repoDir });
    managers.push(mgr);
    await mgr.init();

    const wt = mgr.getGit();
    const name = (await wt.raw(['config', 'user.name'])).trim();
    const email = (await wt.raw(['config', 'user.email'])).trim();
    expect(name).toBe('Test');
    expect(email).toBe('test@test.com');
  });
});
