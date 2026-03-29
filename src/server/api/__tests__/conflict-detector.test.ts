import { describe, it, expect, vi } from 'vitest';
import { ConflictDetector } from '../conflict-detector.js';
import type { GitAdapter } from '../../git/types.js';

function createMockAdapter(branchSpecs: Record<string, string[]>): GitAdapter {
  return {
    readFile: vi.fn().mockResolvedValue(null),
    listDirectory: vi.fn().mockImplementation(async (_path: string, branch?: string) => {
      const specs = branchSpecs[branch ?? 'main'] ?? [];
      return specs.map((name) => ({ name, type: 'directory' as const }));
    }),
    listBranches: vi.fn().mockResolvedValue(Object.keys(branchSpecs)),
    getCurrentBranch: vi.fn().mockResolvedValue('main'),
    getDefaultBranch: vi.fn().mockResolvedValue('main'),
    getLatestSha: vi.fn().mockResolvedValue('abc123'),
    writeFile: vi.fn().mockResolvedValue(undefined),
  };
}

describe('ConflictDetector', () => {
  it('detects no overlaps when branches have unique specs', async () => {
    const adapter = createMockAdapter({
      main: ['spec-a'],
      'feat/x': ['spec-b'],
      'feat/y': ['spec-c'],
    });

    const detector = new ConflictDetector(adapter);
    const report = await detector.detect();
    expect(report.overlaps).toHaveLength(0);
    expect(report.warnings).toHaveLength(0);
  });

  it('detects overlap when two branches share a spec', async () => {
    const adapter = createMockAdapter({
      main: ['spec-a'],
      'feat/x': ['spec-a', 'spec-b'],
      'feat/y': ['spec-a', 'spec-c'],
    });

    const detector = new ConflictDetector(adapter);
    const report = await detector.detect();
    expect(report.overlaps).toHaveLength(1);
    expect(report.overlaps[0].specDir).toBe('spec-a');
    expect(report.overlaps[0].branches).toContain('feat/x');
    expect(report.overlaps[0].branches).toContain('feat/y');
  });

  it('generates resolution suggestion for conflicting branches', async () => {
    const adapter = createMockAdapter({
      main: [],
      'feat/small': ['spec-a'],
      'feat/big': ['spec-a', 'spec-b', 'spec-c'],
    });

    const detector = new ConflictDetector(adapter);
    const report = await detector.detect();
    expect(report.warnings).toHaveLength(1);
    expect(report.warnings[0].suggestedMergeFirst).toBe('feat/small');
    expect(report.warnings[0].reason).toContain('fewer unique specs');
  });

  it('excludes base branch from comparisons', async () => {
    const adapter = createMockAdapter({
      main: ['spec-a'],
    });

    const detector = new ConflictDetector(adapter);
    const report = await detector.detect();
    expect(report.branchesScanned).toBe(0);
    expect(report.overlaps).toHaveLength(0);
  });

  it('handles three-way overlap', async () => {
    const adapter = createMockAdapter({
      main: [],
      'feat/a': ['spec-shared'],
      'feat/b': ['spec-shared'],
      'feat/c': ['spec-shared'],
    });

    const detector = new ConflictDetector(adapter);
    const report = await detector.detect();
    expect(report.overlaps).toHaveLength(1);
    expect(report.overlaps[0].branches).toHaveLength(3);
    // 3 branches = 3 pairwise warnings
    expect(report.warnings).toHaveLength(3);
  });
});
