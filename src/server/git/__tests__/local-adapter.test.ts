import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import simpleGit from 'simple-git';
import { LocalGitAdapter } from '../local-adapter.js';

/**
 * Integration tests for LocalGitAdapter.
 * Creates a temporary git repo as a test fixture.
 */
describe('LocalGitAdapter', () => {
  let fixtureDir: string;
  let adapter: LocalGitAdapter;

  beforeAll(async () => {
    // Create a temp directory and init a git repo
    fixtureDir = await mkdtemp(join(tmpdir(), 'wheatley-test-'));
    const git = simpleGit(fixtureDir);
    await git.init();
    await git.addConfig('user.email', 'test@test.com');
    await git.addConfig('user.name', 'Test');

    // Create file structure
    await mkdir(join(fixtureDir, 'product-knowledge'), { recursive: true });
    await mkdir(join(fixtureDir, 'specs', '2026-03-28_feature_test'), { recursive: true });

    await writeFile(
      join(fixtureDir, 'product-knowledge', 'ROADMAP.md'),
      '# Roadmap\n\n## Phase 1: MVP\n\n### 1.1 Feature\n\n- [ ] 1.1.1 Task one\n',
    );
    await writeFile(
      join(fixtureDir, 'product-knowledge', 'PROJECT_STATUS.md'),
      '# Status\n\n## Current Focus\n\n### 1. MVP\n\n- [ ] **Task**: In progress\n',
    );
    await writeFile(
      join(fixtureDir, 'specs', '2026-03-28_feature_test', 'README.md'),
      '# Feature: Test\n',
    );

    // Commit everything on main
    await git.add('.');
    await git.commit('Initial commit');

    // Rename branch to main (git init defaults to master on some systems)
    const branch = (await git.revparse(['--abbrev-ref', 'HEAD'])).trim();
    if (branch !== 'main') {
      await git.branch(['-m', branch, 'main']);
    }

    // Create a second branch with different content
    await git.checkoutLocalBranch('feature-branch');
    await writeFile(
      join(fixtureDir, 'product-knowledge', 'ROADMAP.md'),
      '# Roadmap\n\n## Phase 1: MVP\n\n### 1.1 Feature\n\n- [x] 1.1.1 Task one (done on feature branch)\n',
    );
    await git.add('.');
    await git.commit('Mark task done');

    // Switch back to main
    await git.checkout('main');

    adapter = new LocalGitAdapter(fixtureDir);
  });

  afterAll(async () => {
    await rm(fixtureDir, { recursive: true, force: true });
  });

  describe('readFile', () => {
    it('reads a file from the working tree', async () => {
      const content = await adapter.readFile('product-knowledge/ROADMAP.md');
      expect(content).toContain('# Roadmap');
      expect(content).toContain('1.1.1 Task one');
    });

    it('returns null for non-existent file', async () => {
      const content = await adapter.readFile('does-not-exist.md');
      expect(content).toBeNull();
    });

    it('reads a file from a specific ref', async () => {
      const content = await adapter.readFile(
        'product-knowledge/ROADMAP.md',
        'feature-branch',
      );
      expect(content).toContain('done on feature branch');
    });

    it('reads committed content when ref matches current branch', async () => {
      const content = await adapter.readFile(
        'product-knowledge/ROADMAP.md',
        'main',
      );
      // Uses git show even for current branch — returns committed content
      expect(content).toContain('1.1.1 Task one');
    });

    it('returns null for path traversal attempt', async () => {
      const content = await adapter.readFile('../../etc/passwd');
      expect(content).toBeNull();
    });

    it('returns null for invalid ref', async () => {
      const content = await adapter.readFile(
        'product-knowledge/ROADMAP.md',
        '--malicious',
      );
      expect(content).toBeNull();
    });
  });

  describe('listDirectory', () => {
    it('lists directory contents from working tree', async () => {
      const entries = await adapter.listDirectory('product-knowledge');
      expect(entries.length).toBeGreaterThanOrEqual(2);

      const names = entries.map((e) => e.name);
      expect(names).toContain('ROADMAP.md');
      expect(names).toContain('PROJECT_STATUS.md');
    });

    it('identifies files and directories', async () => {
      const entries = await adapter.listDirectory('.');
      const specsEntry = entries.find((e) => e.name === 'specs');
      expect(specsEntry?.type).toBe('directory');

      const pkEntries = await adapter.listDirectory('product-knowledge');
      const roadmap = pkEntries.find((e) => e.name === 'ROADMAP.md');
      expect(roadmap?.type).toBe('file');
    });

    it('returns empty array for non-existent directory', async () => {
      const entries = await adapter.listDirectory('no-such-dir');
      expect(entries).toEqual([]);
    });

    it('lists spec subdirectories', async () => {
      const entries = await adapter.listDirectory('specs');
      const names = entries.map((e) => e.name);
      expect(names).toContain('2026-03-28_feature_test');
    });

    it('returns empty array for path traversal attempt', async () => {
      const entries = await adapter.listDirectory('../../etc');
      expect(entries).toEqual([]);
    });

    it('lists directory from a specific ref via git ls-tree', async () => {
      const entries = await adapter.listDirectory('product-knowledge', 'main');
      const names = entries.map((e) => e.name);
      expect(names).toContain('ROADMAP.md');
      expect(names).toContain('PROJECT_STATUS.md');
    });
  });

  describe('listBranches', () => {
    it('returns all local branches', async () => {
      const branches = await adapter.listBranches();
      expect(branches).toContain('main');
      expect(branches).toContain('feature-branch');
    });
  });

  describe('getCurrentBranch', () => {
    it('returns the current branch name', async () => {
      const branch = await adapter.getCurrentBranch();
      expect(branch).toBe('main');
    });
  });

  describe('getDefaultBranch', () => {
    it('returns main when it exists', async () => {
      const branch = await adapter.getDefaultBranch();
      expect(branch).toBe('main');
    });
  });

  describe('getLatestSha', () => {
    it('returns a SHA for the current branch', async () => {
      const sha = await adapter.getLatestSha();
      expect(sha).toBeTruthy();
      expect(sha!.length).toBeGreaterThanOrEqual(7); // Abbreviated or full SHA
    });

    it('returns a SHA for a named branch', async () => {
      const sha = await adapter.getLatestSha('feature-branch');
      expect(sha).toBeTruthy();
    });

    it('returns null for non-existent branch', async () => {
      const sha = await adapter.getLatestSha('does-not-exist');
      expect(sha).toBeNull();
    });
  });
});
