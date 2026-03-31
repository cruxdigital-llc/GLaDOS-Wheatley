/**
 * BranchHealthService tests
 */

import { describe, it, expect } from 'vitest';
import { BranchHealthService } from '../branch-health.js';
import type { GitAdapter, DirectoryEntry } from '../../git/types.js';

// ---------------------------------------------------------------------------
// Fixture adapter factory
// ---------------------------------------------------------------------------

interface FixtureAdapterOptions {
  branches?: string[];
  defaultBranch?: string;
  specDirs?: Record<string, string[]>;
  commitsBehind?: Record<string, number>;
  lastCommitDates?: Record<string, string | null>;
}

function makeAdapter(opts: FixtureAdapterOptions = {}): GitAdapter {
  const {
    branches = ['main', 'feat/a', 'feat/b'],
    defaultBranch = 'main',
    specDirs = {
      main: ['shared-spec'],
      'feat/a': ['shared-spec', 'feat-a-spec'],
      'feat/b': ['shared-spec', 'feat-b-spec'],
    },
    commitsBehind = { 'feat/a': 2, 'feat/b': 5, main: 0 },
    lastCommitDates = {
      main: '2026-01-01T00:00:00Z',
      'feat/a': '2026-01-10T00:00:00Z',
      'feat/b': '2025-12-01T00:00:00Z',
    },
  } = opts;

  return {
    readFile: async () => null,
    listDirectory: async (path: string, ref?: string): Promise<DirectoryEntry[]> => {
      if (path === 'specs') {
        const branch = ref ?? defaultBranch;
        const dirs = specDirs[branch] ?? [];
        return dirs.map((name) => ({
          name,
          type: 'directory' as const,
          path: `specs/${name}`,
        }));
      }
      return [];
    },
    listBranches: async () => branches,
    getCurrentBranch: async () => defaultBranch,
    getDefaultBranch: async () => defaultBranch,
    getLatestSha: async () => 'abc123',
    writeFile: async () => {},
    getCommitsBehind: async (branch) => commitsBehind[branch] ?? 0,
    getLastCommitDate: async (branch) => lastCommitDates[branch] ?? null,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BranchHealthService', () => {
  describe('computeHealth — basic fields', () => {
    it('returns one health entry per branch', async () => {
      const service = new BranchHealthService(makeAdapter());
      const results = await service.computeHealth();
      expect(results).toHaveLength(3);
    });

    it('populates commitsBehind correctly', async () => {
      const service = new BranchHealthService(makeAdapter());
      const results = await service.computeHealth();
      const featA = results.find((r) => r.branch === 'feat/a')!;
      expect(featA.commitsBehind).toBe(2);
    });

    it('populates lastCommitDate correctly', async () => {
      const service = new BranchHealthService(makeAdapter());
      const results = await service.computeHealth();
      const featB = results.find((r) => r.branch === 'feat/b')!;
      expect(featB.lastCommitDate).toBe('2025-12-01T00:00:00Z');
    });

    it('returns null lastCommitDate when adapter returns null', async () => {
      const adapter = makeAdapter({ lastCommitDates: { main: null, 'feat/a': null, 'feat/b': null } });
      const service = new BranchHealthService(adapter);
      const results = await service.computeHealth();
      for (const r of results) {
        expect(r.lastCommitDate).toBeNull();
      }
    });
  });

  describe('computeHealth — uniqueSpecs', () => {
    it('uniqueSpecs contains dirs present on branch but not on base', async () => {
      const service = new BranchHealthService(makeAdapter());
      const results = await service.computeHealth(undefined, 'main');
      const featA = results.find((r) => r.branch === 'feat/a')!;
      expect(featA.uniqueSpecs).toEqual(['feat-a-spec']);
    });

    it('base branch has no uniqueSpecs (all its dirs are on base)', async () => {
      const service = new BranchHealthService(makeAdapter());
      const results = await service.computeHealth(undefined, 'main');
      const mainResult = results.find((r) => r.branch === 'main')!;
      expect(mainResult.uniqueSpecs).toEqual([]);
    });
  });

  describe('computeHealth — conflictRisk', () => {
    it('flags conflict risk when two branches share a unique spec dir', async () => {
      const adapter = makeAdapter({
        specDirs: {
          main: [],
          'feat/a': ['shared-new-spec'],
          'feat/b': ['shared-new-spec'],
        },
      });
      const service = new BranchHealthService(adapter);
      const results = await service.computeHealth(undefined, 'main');
      const featA = results.find((r) => r.branch === 'feat/a')!;
      const featB = results.find((r) => r.branch === 'feat/b')!;
      expect(featA.conflictRisk).toBe(true);
      expect(featB.conflictRisk).toBe(true);
    });

    it('no conflict risk when unique specs do not overlap', async () => {
      const service = new BranchHealthService(makeAdapter());
      const results = await service.computeHealth(undefined, 'main');
      const featA = results.find((r) => r.branch === 'feat/a')!;
      const featB = results.find((r) => r.branch === 'feat/b')!;
      expect(featA.conflictRisk).toBe(false);
      expect(featB.conflictRisk).toBe(false);
    });

    it('main branch has no conflict risk when only feature branches conflict', async () => {
      const adapter = makeAdapter({
        specDirs: {
          main: [],
          'feat/a': ['shared-new-spec'],
          'feat/b': ['shared-new-spec'],
        },
      });
      const service = new BranchHealthService(adapter);
      const results = await service.computeHealth(undefined, 'main');
      const mainResult = results.find((r) => r.branch === 'main')!;
      expect(mainResult.conflictRisk).toBe(false);
    });
  });

  describe('computeHealth — custom branch list', () => {
    it('accepts an explicit branch list', async () => {
      const service = new BranchHealthService(makeAdapter());
      const results = await service.computeHealth(['feat/a'], 'main');
      expect(results).toHaveLength(1);
      expect(results[0].branch).toBe('feat/a');
    });
  });

  describe('computeHealth — custom base branch', () => {
    it('uses adapter default branch when base is omitted', async () => {
      const service = new BranchHealthService(makeAdapter({ defaultBranch: 'main' }));
      // Should not throw
      const results = await service.computeHealth();
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
