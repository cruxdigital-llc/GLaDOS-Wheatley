import { describe, it, expect, vi } from 'vitest';
import { runStartupChecks } from '../startup-check.js';
import type { GitAdapter } from '../git/types.js';

function createMockAdapter(overrides: Partial<GitAdapter> = {}): GitAdapter {
  return {
    readFile: vi.fn().mockResolvedValue('# ROADMAP\n'),
    listDirectory: vi.fn().mockResolvedValue([
      { name: 'spec-one', type: 'directory', path: 'specs/spec-one' },
    ]),
    listBranches: vi.fn().mockResolvedValue(['main', 'develop']),
    getCurrentBranch: vi.fn().mockResolvedValue('main'),
    getDefaultBranch: vi.fn().mockResolvedValue('main'),
    getLatestSha: vi.fn().mockResolvedValue('abc123'),
    writeFile: vi.fn().mockResolvedValue(undefined),
    getCommitsBehind: vi.fn().mockResolvedValue(0),
    getLastCommitDate: vi.fn().mockResolvedValue('2026-03-29T00:00:00Z'),
    getRepoStatus: vi.fn().mockResolvedValue({
      clean: true,
      modified: 0,
      untracked: 0,
      staged: 0,
      conflicted: false,
      conflictedFiles: [],
      worktreeActive: false,
    }),
    getGitIdentity: vi.fn().mockResolvedValue({ name: 'Test', email: 'test@example.com' }),
    fetchOrigin: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('runStartupChecks', () => {
  it('passes when all checks succeed', async () => {
    const adapter = createMockAdapter();

    const result = await runStartupChecks(adapter, 'local');

    expect(result.passed).toBe(true);
    expect(result.checks.every((c) => c.passed)).toBe(true);
  });

  it('fails when adapter returns no branches', async () => {
    const adapter = createMockAdapter({
      listBranches: vi.fn().mockResolvedValue([]),
    });

    const result = await runStartupChecks(adapter, 'local');

    expect(result.passed).toBe(false);
    const gitCheck = result.checks.find((c) => c.name === 'git-connectivity');
    expect(gitCheck?.passed).toBe(false);
  });

  it('fails when ROADMAP.md and specs/ both missing', async () => {
    const adapter = createMockAdapter({
      readFile: vi.fn().mockResolvedValue(null),
      listDirectory: vi.fn().mockResolvedValue([]),
    });

    const result = await runStartupChecks(adapter, 'local');

    expect(result.passed).toBe(false);
    const conformanceCheck = result.checks.find((c) => c.name === 'repo-conformance');
    expect(conformanceCheck?.passed).toBe(false);
  });

  it('passes with only specs/ directory present', async () => {
    const adapter = createMockAdapter({
      readFile: vi.fn().mockImplementation(async (path: string) => {
        // ROADMAP.md not found, but README.md exists for the file-read check
        if (path === 'ROADMAP.md') return null;
        if (path === 'README.md') return '# README\n';
        return null;
      }),
      listDirectory: vi.fn().mockResolvedValue([
        { name: 'spec-one', type: 'directory', path: 'specs/spec-one' },
      ]),
    });

    const result = await runStartupChecks(adapter, 'local');

    expect(result.passed).toBe(true);
    const conformanceCheck = result.checks.find((c) => c.name === 'repo-conformance');
    expect(conformanceCheck?.passed).toBe(true);
  });
});
