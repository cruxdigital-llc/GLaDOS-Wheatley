/**
 * Branch Routes
 *
 * GET /api/branches — list available branches
 * POST /api/branch — switch active branch
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
      boardService.getActiveBranch(),
    ]);

    return {
      branches,
      current,
    };
  });

  app.post<{ Body: { branch: string } }>('/api/branch', async (request, reply) => {
    const { branch } = request.body ?? {};

    if (!branch || typeof branch !== 'string') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Request body must include "branch" (string)',
      });
    }

    // Verify the branch exists
    const branches = await adapter.listBranches();
    if (!branches.includes(branch)) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Branch "${branch}" not found`,
      });
    }

    boardService.setActiveBranch(branch);

    return {
      success: true,
      branch,
    };
  });
}
