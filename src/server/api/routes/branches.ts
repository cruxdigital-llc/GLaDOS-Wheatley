/**
 * Branch Routes
 *
 * GET /api/branches        — list available branches with current branch
 * GET /api/branches/health — health indicators per branch
 */

import type { FastifyInstance } from 'fastify';
import type { GitAdapter } from '../../git/types.js';
import type { BoardService } from '../board-service.js';
import { BranchHealthService } from '../branch-health.js';

export function branchRoutes(
  app: FastifyInstance,
  adapter: GitAdapter,
  boardService: BoardService,
  healthService?: BranchHealthService,
): void {
  const resolvedHealthService = healthService ?? new BranchHealthService(adapter);
  app.get('/api/branches', async () => {
    const [branches, current] = await Promise.all([
      adapter.listBranches(),
      boardService.getCurrentBranch(),
    ]);

    return {
      branches,
      current,
    };
  });

  app.get<{ Querystring: { base?: string } }>('/api/branches/health', async (request) => {
    const baseBranch = request.query.base || undefined;
    const health = await resolvedHealthService.computeHealth(undefined, baseBranch);
    return { health };
  });
}
