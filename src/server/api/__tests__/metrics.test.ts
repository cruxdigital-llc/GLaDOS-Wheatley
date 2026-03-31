import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { updateMetrics, recordGitOp, metrics } from '../routes/metrics.js';
import { createServer } from '../server.js';
import type { GitAdapter, DirectoryEntry } from '../../git/types.js';

function createMinimalAdapter(): GitAdapter {
  const files: Record<string, string> = {
    'product-knowledge/ROADMAP.md': '# Roadmap\n',
    'product-knowledge/PROJECT_STATUS.md': '# Status\n',
    'product-knowledge/claims.md': '',
  };

  return {
    readFile: async (path: string) => files[path] ?? null,
    listDirectory: async () => [],
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

describe('updateMetrics', () => {
  it('updates gauge values', () => {
    updateMetrics('sseConnections', 5);
    expect(metrics.sseConnections).toBe(5);

    updateMetrics('boardCards', 42);
    expect(metrics.boardCards).toBe(42);
  });
});

describe('recordGitOp', () => {
  it('stores observations', () => {
    // Clear any previous observations
    metrics.gitOpDuration.clear();

    recordGitOp('readFile', 0.05);
    recordGitOp('readFile', 0.12);
    recordGitOp('listBranches', 0.03);

    expect(metrics.gitOpDuration.get('readFile')).toEqual([0.05, 0.12]);
    expect(metrics.gitOpDuration.get('listBranches')).toEqual([0.03]);
  });
});

describe('metricsRoutes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createServer({
      adapter: createMinimalAdapter(),
      corsOrigin: true,
      logger: false,
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers /metrics endpoint', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/metrics',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.body).toContain('wheatley_http_requests_total');
    expect(response.body).toContain('wheatley_board_cards_total');
  });
});
