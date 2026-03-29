/**
 * Branch Routes
 *
 * GET /api/branches — list available branches with current branch
 */

import type { FastifyInstance } from 'fastify';
import type { GitAdapter } from '../../git/types.js';
import type { BoardService } from '../board-service.js';

export function branchRoutes(
  app: FastifyInstance,
  adapter: GitAdapter,
  boardService: BoardService,
): void {
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
}
