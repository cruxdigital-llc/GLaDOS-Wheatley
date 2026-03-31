import { describe, it, expect, vi } from 'vitest';
import { BoardService } from '../board-service.js';
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

describe('BoardService', () => {
  it('returns empty board state when repo has no content', async () => {
    const service = new BoardService(createMockAdapter());
    const state = await service.getBoardState();

    expect(state.columns).toHaveLength(6);
    expect(state.metadata.totalCards).toBe(0);
  });

  it('parses roadmap content into board cards', async () => {
    const adapter = createMockAdapter({
      readFile: vi.fn().mockImplementation((path: string) => {
        if (path === 'product-knowledge/ROADMAP.md') {
          return Promise.resolve(
            '# Roadmap\n\n## Phase 1: MVP\n\n**Goal**: Build it.\n\n### 1.1 Feature\n\n- [ ] 1.1.1 Task\n',
          );
        }
        return Promise.resolve(null);
      }),
    });

    const service = new BoardService(adapter);
    const state = await service.getBoardState();

    expect(state.metadata.totalCards).toBe(1);
  });

  it('passes branch to adapter when specified', async () => {
    const adapter = createMockAdapter();
    const service = new BoardService(adapter);

    await service.getBoardState('develop');

    expect(adapter.readFile).toHaveBeenCalledWith(
      'product-knowledge/ROADMAP.md',
      'develop',
    );
  });

  it('passes undefined ref when no branch specified', async () => {
    const adapter = createMockAdapter();
    const service = new BoardService(adapter);

    await service.getBoardState();

    expect(adapter.readFile).toHaveBeenCalledWith(
      'product-knowledge/ROADMAP.md',
      undefined,
    );
  });

  it('getCardDetail returns card', async () => {
    const adapter = createMockAdapter({
      readFile: vi.fn().mockImplementation((path: string) => {
        if (path === 'product-knowledge/ROADMAP.md') {
          return Promise.resolve(
            '# Roadmap\n\n## Phase 1: MVP\n\n**Goal**: Build it.\n\n### 1.1 Feature\n\n- [ ] 1.1.1 Task\n',
          );
        }
        return Promise.resolve(null);
      }),
    });

    const service = new BoardService(adapter);
    const detail = await service.getCardDetail('1.1.1');

    expect(detail).not.toBeNull();
    expect(detail!.card.id).toBe('1.1.1');
  });

  it('getCardDetail returns null for non-existent card', async () => {
    const service = new BoardService(createMockAdapter());
    const detail = await service.getCardDetail('99.99.99');
    expect(detail).toBeNull();
  });

  it('getCurrentBranch delegates to adapter', async () => {
    const adapter = createMockAdapter();
    const service = new BoardService(adapter);

    const branch = await service.getCurrentBranch();
    expect(branch).toBe('main');
    expect(adapter.getCurrentBranch).toHaveBeenCalled();
  });

  it('reads spec directory contents for card detail', async () => {
    const files: Record<string, string> = {
      'product-knowledge/ROADMAP.md': '# Roadmap\n\n## Phase 1: MVP\n\n**Goal**: Build it.\n\n### 1.1 Feature\n\n- [ ] 1.1.1 Task\n',
      'specs/2026-03-28_feature_feature/README.md': '# Feature\n',
      'specs/2026-03-28_feature_feature/plan.md': '# Plan\n',
    };

    const dirs: Record<string, DirectoryEntry[]> = {
      specs: [{ name: '2026-03-28_feature_feature', type: 'directory', path: 'specs/2026-03-28_feature_feature' }],
      'specs/2026-03-28_feature_feature': [
        { name: 'README.md', type: 'file', path: 'specs/2026-03-28_feature_feature/README.md' },
        { name: 'plan.md', type: 'file', path: 'specs/2026-03-28_feature_feature/plan.md' },
      ],
    };

    const adapter = createMockAdapter({
      readFile: vi.fn().mockImplementation((path: string) => Promise.resolve(files[path] ?? null)),
      listDirectory: vi.fn().mockImplementation((path: string) => Promise.resolve(dirs[path] ?? [])),
    });

    const service = new BoardService(adapter);
    const board = await service.getBoardState();

    const specCards = board.columns.flatMap((c) => c.cards).filter((c) => c.specEntry);
    expect(specCards.length).toBeGreaterThan(0);

    if (specCards.length > 0) {
      const detail = await service.getCardDetail(specCards[0].id);
      expect(detail?.specContents).toBeDefined();
    }
  });
});
