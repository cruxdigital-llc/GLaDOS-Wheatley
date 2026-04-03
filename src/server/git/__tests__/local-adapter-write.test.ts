/**
 * LocalGitAdapter.writeFile integration tests
 *
 * Creates a temp git repo with a bare "remote" to test push/conflict scenarios.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import simpleGit from 'simple-git';
import { LocalGitAdapter } from '../local-adapter.js';
import { ConflictError } from '../types.js';

describe('LocalGitAdapter.writeFile', () => {
  let bareDir: string;   // bare "remote" repo
  let repoDir: string;   // working clone
  let adapter: LocalGitAdapter;

  // These tests exercise push behavior — enable push-on-write
  const origPushEnv = process.env['WHEATLEY_PUSH_ON_WRITE'];

  beforeAll(async () => {
    process.env['WHEATLEY_PUSH_ON_WRITE'] = 'true';
    // Create a bare repo that acts as the remote
    bareDir = await mkdtemp(join(tmpdir(), 'wheatley-bare-'));
    const bareGit = simpleGit(bareDir);
    await bareGit.init(['--bare']);

    // Clone the bare repo into a working directory
    repoDir = await mkdtemp(join(tmpdir(), 'wheatley-repo-'));
    const git = simpleGit(repoDir);
    await git.clone(bareDir, repoDir);
    await git.addConfig('user.email', 'test@test.com');
    await git.addConfig('user.name', 'Test');

    // Create an initial commit so HEAD is valid
    await mkdir(join(repoDir, 'product-knowledge'), { recursive: true });
    await writeFile(join(repoDir, 'product-knowledge', 'ROADMAP.md'), '# Roadmap\n');
    await writeFile(join(repoDir, 'product-knowledge/claims.md'), '');
    await git.add('.');
    await git.commit('Initial commit');

    // Rename to main if needed
    const branch = (await git.revparse(['--abbrev-ref', 'HEAD'])).trim();
    if (branch !== 'main') {
      await git.branch(['-m', branch, 'main']);
    }

    // Push to establish tracking
    await git.push('origin', 'main', ['--set-upstream']);

    adapter = new LocalGitAdapter(repoDir);
  });

  afterAll(async () => {
    // Restore env
    if (origPushEnv === undefined) delete process.env['WHEATLEY_PUSH_ON_WRITE'];
    else process.env['WHEATLEY_PUSH_ON_WRITE'] = origPushEnv;

    await rm(bareDir, { recursive: true, force: true });
    await rm(repoDir, { recursive: true, force: true });
  });

  it('writes a file, commits, and pushes to the coordination branch', async () => {
    const content = '# Claims\n\n- [claimed] 1.1.1 | tester | 2026-03-28T10:00:00Z\n';
    await adapter.writeFile('product-knowledge/claims.md', content, 'claim: 1.1.1 by tester', 'main');

    // Verify the committed content via git show
    const written = await adapter.readFile('product-knowledge/claims.md', 'main');
    expect(written).toBe(content);
  });

  it('creates intermediate directories if needed', async () => {
    const content = '# New file\n';
    await adapter.writeFile('subdir/new.md', content, 'add subdir/new.md', 'main');

    const written = await adapter.readFile('subdir/new.md', 'main');
    expect(written).toBe(content);
  });

  it('restores original branch after write', async () => {
    const originalBranch = await adapter.getCurrentBranch();
    await adapter.writeFile('product-knowledge/claims.md', '# Claims\n', 'test restore', 'main');
    const currentBranch = await adapter.getCurrentBranch();
    expect(currentBranch).toBe(originalBranch);
  });

  it('throws ConflictError on push rejection (non-fast-forward)', async () => {
    // Make a competing commit directly to the bare repo via a second clone
    const rival = await mkdtemp(join(tmpdir(), 'wheatley-rival-'));
    try {
      const rivalGit = simpleGit(rival);
      await rivalGit.clone(bareDir, rival);
      await rivalGit.addConfig('user.email', 'rival@test.com');
      await rivalGit.addConfig('user.name', 'Rival');

      // Rival writes to the same file and pushes first
      const rivalAdapter = new LocalGitAdapter(rival);
      await rivalAdapter.writeFile(
        'product-knowledge/claims.md',
        '# Claims\n\n- [claimed] 9.9.9 | rival | 2026-03-28T11:00:00Z\n',
        'rival claim',
        'main',
      );

      // Now our adapter tries to push a conflicting write
      // First, make a commit locally that won't fast-forward
      const localGit = simpleGit(repoDir);
      // Rewrite local claims.md without fetching to create divergence
      await writeFile(join(repoDir, 'product-knowledge/claims.md'), '# Claims\n\nlocal diverge\n', 'utf-8');
      await localGit.add('product-knowledge/claims.md');
      await localGit.commit('local diverging commit');

      // The push should fail as non-fast-forward — but writeFile calls push directly
      // We need to test this via the adapter; we'll patch by creating our own competing commit
      // Actually the rival's push already advanced origin/main; our local main is behind
      // so pushing will be rejected. But our adapter does not fetch first,
      // so the push will be non-fast-forward.
      // We need to trigger the ConflictError path by making a second competing push.

      // Create another rival write to advance origin again
      await rivalAdapter.writeFile(
        'product-knowledge/claims.md',
        '# Claims\n\nrival2\n',
        'rival2',
        'main',
      );

      // Our local repo is now 2 commits behind; push should fail
      await expect(
        adapter.writeFile(
          'product-knowledge/claims.md',
          '# Claims\n\nour write\n',
          'our conflicting write',
          'main',
        ),
      ).rejects.toThrow(ConflictError);
    } finally {
      await rm(rival, { recursive: true, force: true });
    }
  });

  it('rejects path traversal attempts', async () => {
    await expect(
      adapter.writeFile('../../etc/hosts', 'pwned', 'bad write', 'main'),
    ).rejects.toThrow();
  });
});
