import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createServer } from '../server.js';
import type { GitAdapter, DirectoryEntry } from '../../git/types.js';

/** Minimal mock adapter that serves fixture data. */
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
      { name: 'plan.md', type: 'file', path: 'specs/2026-03-28_feature_feature-one/plan.md' },
    ],
  };

  files['specs/2026-03-28_feature_feature-one/README.md'] = '# Feature One\n';
  files['specs/2026-03-28_feature_feature-one/plan.md'] = '# Plan\n\n## Steps\n\n1. Do stuff\n';

  return {
    readFile: async (path: string) => files[path] ?? null,
    listDirectory: async (path: string) => dirs[path] ?? [],
    listBranches: async () => ['main', 'develop'],
    getCurrentBranch: async () => 'main',
    getDefaultBranch: async () => 'main',
    getLatestSha: async () => 'abc123',
  };
}

describe('API Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createServer({
      adapter: createFixtureAdapter(),
      corsOrigin: true,
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/health', () => {
    it('returns status ok', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/health',
      });
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.status).toBe('ok');
      expect(body.timestamp).toBeDefined();
      expect(body.uptime).toBeGreaterThan(0);
    });
  });

  describe('GET /api/board', () => {
    it('returns board state with columns and metadata', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/board',
      });
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.columns).toHaveLength(6);
      expect(body.metadata).toBeDefined();
      expect(body.metadata.totalCards).toBeGreaterThan(0);
    });

    it('returns correct column phases', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/board',
      });
      const body = response.json();
      const phases = body.columns.map((c: { phase: string }) => c.phase);
      expect(phases).toEqual([
        'unclaimed', 'planning', 'speccing', 'implementing', 'verifying', 'done',
      ]);
    });
  });

  describe('GET /api/board/card/:id', () => {
    it('returns card detail for existing card', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/board/card/1.1.1',
      });
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.card).toBeDefined();
      expect(body.card.id).toBe('1.1.1');
    });

    it('returns 404 for non-existent card', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/board/card/99.99.99',
      });
      expect(response.statusCode).toBe(404);
    });

    it('returns completed card', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/board/card/1.1.2',
      });
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.card.phase).toBe('done');
    });
  });

  describe('GET /api/branches', () => {
    it('returns branch list with current branch', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/branches',
      });
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.branches).toEqual(['main', 'develop']);
      expect(body.current).toBe('main');
    });
  });

  describe('POST /api/branch', () => {
    it('switches to a valid branch', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/branch',
        payload: { branch: 'develop' },
      });
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.branch).toBe('develop');
    });

    it('returns 404 for non-existent branch', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/branch',
        payload: { branch: 'nonexistent' },
      });
      expect(response.statusCode).toBe(404);
    });

    it('returns 400 for missing branch in body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/branch',
        payload: {},
      });
      expect(response.statusCode).toBe(400);
    });
  });
});
