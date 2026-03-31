/**
 * BranchScanner tests
 *
 * Exercises branch filtering, SHA-based caching, and env-var configuration.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BranchScanner, type BranchScanConfig } from '../branch-scanner.js';
import type { GitAdapter, DirectoryEntry } from '../../git/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAdapter(overrides: Partial<GitAdapter> = {}): GitAdapter {
  return {
    readFile: async (path: string) => {
      if (path === 'product-knowledge/ROADMAP.md') {
        return [
          '# Roadmap',
          '',
          '## Phase 1: Test',
          '',
          '**Goal**: Test.',
          '',
          '### 1.1 Section',
          '',
          '- [ ] 1.1.1 Task One',
        ].join('\n');
      }
      return null;
    },
    listDirectory: async (): Promise<DirectoryEntry[]> => [],
    listBranches: async () => ['main', 'feat/alpha', 'feat/beta', 'chore/cleanup'],
    getCurrentBranch: async () => 'main',
    getDefaultBranch: async () => 'main',
    getLatestSha: async (branch?: string) => `sha-${branch ?? 'main'}`,
    writeFile: async () => {},
    getCommitsBehind: async () => 0,
    getLastCommitDate: async () => null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BranchScanner', () => {
  beforeEach(() => {
    // Clear env vars between tests
    delete process.env['WHEATLEY_SCAN_INCLUDE'];
    delete process.env['WHEATLEY_SCAN_EXCLUDE'];
  });

  describe('scanAllBranches — no config (include all)', () => {
    it('returns a ScanResult for every branch when no filters are set', async () => {
      const adapter = makeAdapter();
      const scanner = new BranchScanner(adapter);
      const results = await scanner.scanAllBranches();
      expect(results).toHaveLength(4);
      expect(results.map((r) => r.branch).sort()).toEqual([
        'chore/cleanup',
        'feat/alpha',
        'feat/beta',
        'main',
      ]);
    });

    it('each result contains branch, boardState, and sha', async () => {
      const scanner = new BranchScanner(makeAdapter());
      const results = await scanner.scanAllBranches();
      for (const r of results) {
        expect(r.branch).toBeTruthy();
        expect(r.sha).toBe(`sha-${r.branch}`);
        expect(r.boardState.columns).toBeDefined();
      }
    });
  });

  describe('scanAllBranches — prefix filtering', () => {
    it('includes only branches with matching prefix', async () => {
      const scanner = new BranchScanner(makeAdapter());
      const config: BranchScanConfig = { prefixes: ['feat/'] };
      const results = await scanner.scanAllBranches(config);
      expect(results).toHaveLength(2);
      expect(results.map((r) => r.branch).sort()).toEqual(['feat/alpha', 'feat/beta']);
    });
  });

  describe('scanAllBranches — include patterns', () => {
    it('includes only branches matching include regex', async () => {
      const scanner = new BranchScanner(makeAdapter());
      const config: BranchScanConfig = { include: [/^feat\//] };
      const results = await scanner.scanAllBranches(config);
      expect(results.map((r) => r.branch).sort()).toEqual(['feat/alpha', 'feat/beta']);
    });
  });

  describe('scanAllBranches — exclude patterns', () => {
    it('excludes branches matching exclude regex', async () => {
      const scanner = new BranchScanner(makeAdapter());
      const config: BranchScanConfig = { exclude: [/^chore\//] };
      const results = await scanner.scanAllBranches(config);
      const names = results.map((r) => r.branch);
      expect(names).not.toContain('chore/cleanup');
      expect(names).toHaveLength(3);
    });

    it('exclude takes priority over include', async () => {
      const scanner = new BranchScanner(makeAdapter());
      const config: BranchScanConfig = {
        include: [/^feat\//],
        exclude: [/alpha/],
      };
      const results = await scanner.scanAllBranches(config);
      expect(results.map((r) => r.branch)).toEqual(['feat/beta']);
    });
  });

  describe('SHA-based caching', () => {
    it('does not re-parse a branch when SHA is unchanged', async () => {
      const getBoardState = vi.fn().mockResolvedValue({
        columns: [],
        metadata: { totalCards: 0, claimedCount: 0, completedCount: 0 },
      });

      // We spy on getBoardState by proxying readFile calls; instead, intercept
      // at the adapter level — count readFile invocations as proxy for parsing.
      const readFileCalls: string[] = [];
      const adapter = makeAdapter({
        readFile: async (path) => {
          readFileCalls.push(path);
          if (path === 'product-knowledge/ROADMAP.md') {
            return '# Roadmap\n\n## Phase 1: T\n\n**Goal**: T.\n\n### 1.1 S\n\n- [ ] 1.1.1 X\n';
          }
          return null;
        },
      });

      const scanner = new BranchScanner(adapter);

      // First scan — all branches parsed
      await scanner.scanAllBranches({ prefixes: ['feat/'] });
      const firstCount = readFileCalls.length;

      // Second scan — SHAs unchanged, cache should be hit — no re-parsing
      await scanner.scanAllBranches({ prefixes: ['feat/'] });
      const secondCount = readFileCalls.length;

      expect(secondCount).toBe(firstCount); // no new readFile calls
      void getBoardState; // suppress unused var warning
    });

    it('re-parses a branch when SHA changes', async () => {
      let callCount = 0;
      let shaOverride = 'sha-v1';
      const adapter = makeAdapter({
        readFile: async (path) => {
          callCount++;
          if (path === 'product-knowledge/ROADMAP.md') {
            return '# Roadmap\n\n## Phase 1: T\n\n**Goal**: T.\n\n### 1.1 S\n\n- [ ] 1.1.1 X\n';
          }
          return null;
        },
        listBranches: async () => ['feat/alpha'],
        getLatestSha: async () => shaOverride,
      });

      const scanner = new BranchScanner(adapter);
      await scanner.scanAllBranches();
      const countAfterFirst = callCount;

      // Simulate a new commit on the branch
      shaOverride = 'sha-v2';
      await scanner.scanAllBranches();
      expect(callCount).toBeGreaterThan(countAfterFirst);
    });

    it('clearCache() forces re-parse on next scan', async () => {
      let callCount = 0;
      const adapter = makeAdapter({
        readFile: async (path) => {
          callCount++;
          if (path === 'product-knowledge/ROADMAP.md') {
            return '# Roadmap\n\n## Phase 1: T\n\n**Goal**: T.\n\n### 1.1 S\n\n- [ ] 1.1.1 X\n';
          }
          return null;
        },
        listBranches: async () => ['main'],
      });

      const scanner = new BranchScanner(adapter);
      await scanner.scanAllBranches();
      const countAfterFirst = callCount;

      scanner.clearCache();
      await scanner.scanAllBranches();
      expect(callCount).toBeGreaterThan(countAfterFirst);
    });
  });

  describe('env-var configuration', () => {
    it('WHEATLEY_SCAN_INCLUDE filters branches', async () => {
      process.env['WHEATLEY_SCAN_INCLUDE'] = '^feat/';
      const scanner = new BranchScanner(makeAdapter());
      const results = await scanner.scanAllBranches();
      expect(results.every((r) => r.branch.startsWith('feat/'))).toBe(true);
    });

    it('WHEATLEY_SCAN_EXCLUDE filters branches', async () => {
      process.env['WHEATLEY_SCAN_EXCLUDE'] = '^chore/';
      const scanner = new BranchScanner(makeAdapter());
      const results = await scanner.scanAllBranches();
      expect(results.some((r) => r.branch.startsWith('chore/'))).toBe(false);
    });
  });

  describe('handles adapter errors gracefully', () => {
    it('omits branches whose SHA cannot be resolved', async () => {
      const adapter = makeAdapter({
        getLatestSha: async (branch) => (branch === 'feat/alpha' ? null : `sha-${branch}`),
      });
      const scanner = new BranchScanner(adapter);
      const results = await scanner.scanAllBranches({ prefixes: ['feat/'] });
      expect(results.map((r) => r.branch)).toEqual(['feat/beta']);
    });
  });
});
