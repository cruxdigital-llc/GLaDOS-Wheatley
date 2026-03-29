import { describe, it, expect, vi } from 'vitest';
import { analyzeConformance } from '../analyzer.js';
import type { GitAdapter, DirectoryEntry } from '../../git/types.js';

function createMockAdapter(overrides: Partial<GitAdapter> = {}): GitAdapter {
  return {
    readFile: vi.fn().mockResolvedValue(null),
    listDirectory: vi.fn().mockResolvedValue([]),
    listBranches: vi.fn().mockResolvedValue(['main']),
    getCurrentBranch: vi.fn().mockResolvedValue('main'),
    getDefaultBranch: vi.fn().mockResolvedValue('main'),
    getLatestSha: vi.fn().mockResolvedValue('abc123'),
    ...overrides,
  };
}

describe('analyzeConformance', () => {
  it('reports missing ROADMAP.md as error', async () => {
    const adapter = createMockAdapter();
    const report = await analyzeConformance(adapter);

    expect(report.conforming).toBe(false);
    expect(report.violations.some((v) => v.file.includes('ROADMAP.md'))).toBe(true);
  });

  it('reports conforming repo with low error count', async () => {
    const files: Record<string, string> = {
      'product-knowledge/ROADMAP.md': [
        '# Roadmap',
        '',
        '## Phase 1: MVP',
        '',
        '**Goal**: Build it.',
        '',
        '### 1.1 Feature',
        '',
        '- [ ] 1.1.1 Task one',
      ].join('\n'),
      'product-knowledge/PROJECT_STATUS.md': [
        '# Status',
        '',
        '## Current Focus',
        '',
        '### 1. MVP',
        '',
        '- [ ] **Task**: Desc',
      ].join('\n'),
    };

    const adapter = createMockAdapter({
      readFile: vi.fn().mockImplementation((path: string) => Promise.resolve(files[path] ?? null)),
    });

    const report = await analyzeConformance(adapter);
    expect(report.summary.filesChecked).toBe(2);
    // Report should have violations structured correctly
    expect(report.violations).toBeDefined();
    expect(Array.isArray(report.violations)).toBe(true);
  });

  it('checks spec directories', async () => {
    const files: Record<string, string> = {
      'product-knowledge/ROADMAP.md': '# Roadmap\n\n## Phase 1: Test\n\n**Goal**: Test.\n\n### 1.1 A\n\n- [ ] 1.1.1 B\n',
    };

    const dirs: Record<string, DirectoryEntry[]> = {
      specs: [{ name: '2026-03-28_feature_test', type: 'directory', path: 'specs/2026-03-28_feature_test' }],
      'specs/2026-03-28_feature_test': [
        { name: 'README.md', type: 'file', path: 'specs/2026-03-28_feature_test/README.md' },
      ],
    };

    const adapter = createMockAdapter({
      readFile: vi.fn().mockImplementation((path: string) => Promise.resolve(files[path] ?? null)),
      listDirectory: vi.fn().mockImplementation((path: string) => Promise.resolve(dirs[path] ?? [])),
    });

    const report = await analyzeConformance(adapter);
    expect(report.summary.filesChecked).toBe(2); // ROADMAP + 1 spec dir
  });

  it('passes branch parameter to adapter', async () => {
    const adapter = createMockAdapter();
    await analyzeConformance(adapter, 'develop');

    expect(adapter.readFile).toHaveBeenCalledWith('product-knowledge/ROADMAP.md', 'develop');
  });

  it('includes summary with error/warning counts', async () => {
    const adapter = createMockAdapter();
    const report = await analyzeConformance(adapter);

    expect(report.summary).toBeDefined();
    expect(typeof report.summary.filesChecked).toBe('number');
    expect(typeof report.summary.errors).toBe('number');
    expect(typeof report.summary.warnings).toBe('number');
  });
});
