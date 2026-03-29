/**
 * Board Routes
 *
 * GET /api/board — full board state
 * GET /api/board/card/:id — card detail with spec contents
 */

import type { FastifyInstance } from 'fastify';
import type { BoardService } from '../board-service.js';

export function boardRoutes(app: FastifyInstance, boardService: BoardService): void {
  app.get('/api/board', async () => {
    return boardService.getBoardState();
  });

  app.get<{ Params: { id: string } }>('/api/board/card/:id', async (request, reply) => {
    const { id } = request.params;
    const result = await boardService.getCardDetail(id);

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
