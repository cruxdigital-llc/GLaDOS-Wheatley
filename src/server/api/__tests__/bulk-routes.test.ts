import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createServer } from '../server.js';
import type { GitAdapter, DirectoryEntry } from '../../git/types.js';

function createFixtureAdapter(): GitAdapter {
  const files: Record<string, string> = {
    'product-knowledge/ROADMAP.md': [
      '# Roadmap',
      '',
      '## Phase 1: MVP',
      '',
      '**Goal**: Build the MVP.',
      '',
      '### 1.1 Feature One',
      '',
      '- [ ] 1.1.1 Task A',
      '- [x] 1.1.2 Task B',
    ].join('\n'),
    'product-knowledge/PROJECT_STATUS.md': [
      '# Status',
      '',
      '## Current Focus',
      '',
      '### 1. MVP',
      '',
      '- [ ] **Feature One**: In progress',
    ].join('\n'),
    'product-knowledge/claims.md': '',
  };

  const dirs: Record<string, DirectoryEntry[]> = {
    specs: [
      { name: '2026-03-28_feature_feature-one', type: 'directory', path: 'specs/2026-03-28_feature_feature-one' },
    ],
    'specs/2026-03-28_feature_feature-one': [
      { name: 'README.md', type: 'file', path: 'specs/2026-03-28_feature_feature-one/README.md' },
    ],
  };

  files['specs/2026-03-28_feature_feature-one/README.md'] = '# Feature One\n';

  return {
    readFile: async (path: string) => files[path] ?? null,
    listDirectory: async (path: string) => dirs[path] ?? [],
    listBranches: async () => ['main'],
    getCurrentBranch: async () => 'main',
    getDefaultBranch: async () => 'main',
    getLatestSha: async () => 'abc123',
    writeFile: async () => {},
    getCommitsBehind: async () => 0,
    getLastCommitDate: async () => '2026-03-29T00:00:00Z',
    getRepoStatus: async () => ({
      clean: true,
      modified: 0,
      untracked: 0,
      staged: 0,
      conflicted: false,
      conflictedFiles: [],
      worktreeActive: false,
    }),
    getGitIdentity: async () => ({ name: 'Test', email: 'test@example.com' }),
    fetchOrigin: async () => {},
  };
}

describe('Bulk Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createServer({
      adapter: createFixtureAdapter(),
      corsOrigin: true,
      logger: false,
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/bulk/move', () => {
    it('validates cardIds array', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/bulk/move',
        payload: {
          cardIds: 'not-an-array',
          from: 'unclaimed',
          to: 'planning',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.message).toContain('cardIds');
    });

    it('rejects empty array', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/bulk/move',
        payload: {
          cardIds: [],
          from: 'unclaimed',
          to: 'planning',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.message).toContain('cardIds');
    });
  });

  describe('POST /api/bulk/assign', () => {
    it('validates claimant', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/bulk/assign',
        payload: {
          cardIds: ['1.1.1'],
          claimant: '',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.message).toContain('claimant');
    });
  });

  describe('POST /api/bulk/delete', () => {
    it('validates cardIds format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/bulk/delete',
        payload: {
          cardIds: ['invalid-format', '!!!'],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.message).toContain('cardIds');
    });
  });
});
