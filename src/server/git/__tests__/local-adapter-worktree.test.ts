/**
 * LocalGitAdapter + WorktreeManager integration tests
 *
 * Verifies that writes succeed through the worktree even when
 * the main repo has a dirty working tree.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import simpleGit from 'simple-git';
import { LocalGitAdapter } from '../local-adapter.js';
import { WorktreeManager } from '../worktree-manager.js';

describe('LocalGitAdapter with WorktreeManager', () => {
  let bareDir: string;
  let repoDir: string;
  let adapter: LocalGitAdapter;
  let worktreeManager: WorktreeManager;

  beforeAll(async () => {
    bareDir = await mkdtemp(join(tmpdir(), 'wt-int-bare-'));
    const bareGit = simpleGit(bareDir);
    await bareGit.init(['--bare']);

    repoDir = await mkdtemp(join(tmpdir(), 'wt-int-repo-'));
    const git = simpleGit(repoDir);
    await git.clone(bareDir, repoDir);
    await git.addConfig('user.email', 'test@test.com');
    await git.addConfig('user.name', 'Test');

    await mkdir(join(repoDir, 'product-knowledge'), { recursive: true });
    await writeFile(join(repoDir, 'product-knowledge', 'ROADMAP.md'), '# Roadmap\n');
    await writeFile(join(repoDir, 'product-knowledge', 'claims.md'), '');
    await git.add('.');
    await git.commit('Initial commit');

    const branch = (await git.revparse(['--abbrev-ref', 'HEAD'])).trim();
    if (branch !== 'main') {
      await git.branch(['-m', branch, 'main']);
    }
    await git.push('origin', 'main', ['--set-upstream']);

    worktreeManager = new WorktreeManager({ repoPath: repoDir });
    await worktreeManager.init();

    adapter = new LocalGitAdapter(repoDir, worktreeManager);
  });

  afterAll(async () => {
    await worktreeManager.destroy();
    await rm(bareDir, { recursive: true, force: true });
    await rm(repoDir, { recursive: true, force: true });
  });

  it('writes file via worktree and pushes to origin', async () => {
    const content = '# Claims\n\n- [claimed] 1.1.1 | tester | 2026-03-29T10:00:00Z\n';
    await adapter.writeFile('product-knowledge/claims.md', content, 'claim: 1.1.1 by tester', 'main');

    const written = await adapter.readFile('product-knowledge/claims.md', 'main');
    expect(written).toBe(content);
  });

  it('writes succeed even when main repo working tree is dirty', async () => {
    // Create a dirty file in the main repo
    await writeFile(join(repoDir, 'dirty-file.txt'), 'uncommitted changes');

    // Verify the repo is actually dirty
    const git = simpleGit(repoDir);
    const status = await git.status();
    expect(status.isClean()).toBe(false);

    // Write via adapter should succeed (goes through worktree)
    const content = '# Claims\n\n- [claimed] 2.2.2 | tester | 2026-03-29T11:00:00Z\n';
    await adapter.writeFile('product-knowledge/claims.md', content, 'claim: 2.2.2 by tester', 'main');

    const written = await adapter.readFile('product-knowledge/claims.md', 'main');
    expect(written).toBe(content);

    // Verify the dirty file in main repo is still there (untouched)
    const dirtyContent = await readFile(join(repoDir, 'dirty-file.txt'), 'utf-8');
    expect(dirtyContent).toBe('uncommitted changes');

    // Clean up dirty file
    await rm(join(repoDir, 'dirty-file.txt'));
  });

  it('does not change the main repo current branch', async () => {
    const branchBefore = await adapter.getCurrentBranch();

    await adapter.writeFile('product-knowledge/claims.md', '# Claims\n', 'test branch', 'main');

    const branchAfter = await adapter.getCurrentBranch();
    expect(branchAfter).toBe(branchBefore);
  });

  it('reads from committed state, not working tree', async () => {
    // Write a committed version
    await adapter.writeFile('product-knowledge/claims.md', 'committed\n', 'committed version', 'main');

    // Modify the file in the main repo working tree (not committed)
    await writeFile(join(repoDir, 'product-knowledge', 'claims.md'), 'dirty working tree\n');

    // readFile without ref should read committed state (HEAD), not dirty file
    const content = await adapter.readFile('product-knowledge/claims.md');
    expect(content).toBe('committed\n');

    // Clean up: restore working tree to match HEAD
    const git = simpleGit(repoDir);
    await git.checkout(['--', 'product-knowledge/claims.md']);
  });

  it('rejects path traversal in worktree writes', async () => {
    await expect(
      adapter.writeFile('../../etc/hosts', 'pwned', 'bad write', 'main'),
    ).rejects.toThrow('Path traversal');
  });

  it('creates intermediate directories in worktree', async () => {
    const content = '# New\n';
    await adapter.writeFile('deep/nested/dir/file.md', content, 'create nested', 'main');

    const written = await adapter.readFile('deep/nested/dir/file.md', 'main');
    expect(written).toBe(content);
  });
});
