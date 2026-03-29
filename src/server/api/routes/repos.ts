/**
 * Multi-Repo Routes
 *
 * GET  /api/repos                  — list configured repos
 * GET  /api/repos/:repoId/board    — get board state for a specific repo
 * GET  /api/repos/:repoId/search   — search within a specific repo
 */

import type { FastifyInstance } from 'fastify';
import type { RepoManager } from '../../multi-repo/repo-manager.js';
import { SearchService } from '../search-service.js';

export function repoRoutes(
  app: FastifyInstance,
  repoManager: RepoManager,
): void {
  // GET /api/repos
  app.get('/api/repos', async () => {
    const repos = repoManager.listRepos();
    const defaultRepo = repoManager.getDefault();
    return {
      repos: repos.map((r) => ({ id: r.id, name: r.name })),
      defaultRepo,
    };
  });

  // GET /api/repos/:repoId/board
  app.get<{ Params: { repoId: string } }>(
    '/api/repos/:repoId/board',
    async (request, reply) => {
      const { repoId } = request.params;
      try {
        const boardService = repoManager.getBoardService(repoId);
        const query = request.query as Record<string, string | undefined>;
        const branch = query.branch;
        const board = await boardService.getBoardState(branch);
        return board;
      } catch (err) {
        if ((err as Error).message?.startsWith('Unknown repo')) {
          return reply.status(404).send({
            error: 'Not Found',
            message: `Repository "${repoId}" not found`,
          });
        }
        throw err;
      }
    },
  );

  // GET /api/repos/:repoId/search?q=...
  app.get<{ Params: { repoId: string } }>(
    '/api/repos/:repoId/search',
    async (request, reply) => {
      const { repoId } = request.params;
      const query = request.query as Record<string, string | undefined>;
      const q = query.q;

      if (!q || typeof q !== 'string' || q.trim().length === 0) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Query parameter "q" is required',
        });
      }

      try {
        const boardService = repoManager.getBoardService(repoId);
        const adapter = repoManager.getAdapter(repoId);
        const searchService = new SearchService(boardService, adapter);
        const results = await searchService.search(q.trim(), query.branch);
        return results;
      } catch (err) {
        if ((err as Error).message?.startsWith('Unknown repo')) {
          return reply.status(404).send({
            error: 'Not Found',
            message: `Repository "${repoId}" not found`,
          });
        }
        throw err;
      }
    },
  );
}
