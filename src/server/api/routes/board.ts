/**
 * Board Routes
 *
 * GET /api/board — full board state (optional ?branch= query param)
 * GET /api/board/card/:id — card detail with spec contents
 */

import type { FastifyInstance } from 'fastify';
import type { BoardService } from '../board-service.js';

export function boardRoutes(app: FastifyInstance, boardService: BoardService): void {
  app.get<{ Querystring: { branch?: string } }>('/api/board', async (request) => {
    const branch = request.query.branch || undefined;
    return boardService.getBoardState(branch);
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
    const result = await boardService.getCardDetail(id, branch);

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
