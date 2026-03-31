/**
 * Board Routes
 *
 * GET /api/board — full board state (optional ?branch= query param)
 * GET /api/board/card/:id — card detail with spec contents
 *
 * Claims are always read from the coordination branch (resolved via ClaimService),
 * while roadmap, specs, and status are read from the requested view branch.
 */

import type { FastifyInstance } from 'fastify';
import type { BoardService } from '../board-service.js';
import type { ClaimService } from '../claim-service.js';

export function boardRoutes(
  app: FastifyInstance,
  boardService: BoardService,
  claimService: ClaimService,
): void {
  app.get<{ Querystring: { branch?: string } }>('/api/board', async (request) => {
    const branch = request.query.branch || undefined;
    const coordinationBranch = await claimService.getCoordinationBranch();
    return boardService.getBoardState(branch, coordinationBranch);
  });

  app.get<{
    Params: { id: string };
    Querystring: { branch?: string };
  }>('/api/board/card/:id', async (request, reply) => {
    const { id } = request.params;

    // Validate card ID format
    if (!/^\d+\.\d+\.\d+$/.test(id) && !/^\d{4}-\d{2}-\d{2}_/.test(id)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `Invalid card ID format: "${id}"`,
      });
    }

    const branch = request.query.branch || undefined;
    const coordinationBranch = await claimService.getCoordinationBranch();
    const result = await boardService.getCardDetail(id, branch, coordinationBranch);

    if (!result) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Card "${id}" not found`,
      });
    }

    return result;
  });
}
