/**
 * Transitions Routes
 *
 * POST /api/transitions — execute a phase transition for a board item
 */

import type { FastifyInstance } from 'fastify';
import { PHASE_ORDER } from '../../../shared/grammar/types.js';
import type { BoardPhase } from '../../../shared/grammar/types.js';
import { TransitionService, InvalidTransitionError, ConflictError } from '../transition-service.js';

const VALID_PHASES = new Set<string>(PHASE_ORDER);

function isBoardPhase(value: unknown): value is BoardPhase {
  return typeof value === 'string' && VALID_PHASES.has(value);
}

export function transitionRoutes(app: FastifyInstance, transitionService: TransitionService): void {
  // POST /api/transitions
  app.post<{
    Body: {
      itemId?: unknown;
      from?: unknown;
      to?: unknown;
      branch?: unknown;
      existingSpecDir?: unknown;
    };
  }>('/api/transitions', async (request, reply) => {
    const { itemId, from, to, branch, existingSpecDir } = request.body ?? {};

    // Validate required fields
    if (typeof itemId !== 'string' || !itemId.trim()) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Request body must include "itemId" (non-empty string)',
      });
    }

    if (!isBoardPhase(from)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `"from" must be a valid board phase; got: ${JSON.stringify(from)}`,
      });
    }

    if (!isBoardPhase(to)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `"to" must be a valid board phase; got: ${JSON.stringify(to)}`,
      });
    }

    if (branch !== undefined && typeof branch !== 'string') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: '"branch" must be a string when provided',
      });
    }

    try {
      const result = await transitionService.executeTransition(
        itemId,
        from,
        to,
        typeof branch === 'string' ? branch : undefined,
        typeof existingSpecDir === 'string' ? existingSpecDir : undefined,
      );
      return reply.status(200).send(result);
    } catch (err) {
      if (err instanceof InvalidTransitionError) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: err.message,
        });
      }
      if (err instanceof ConflictError) {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          message: err.message,
          conflict: true,
        });
      }
      throw err;
    }
  });
}
