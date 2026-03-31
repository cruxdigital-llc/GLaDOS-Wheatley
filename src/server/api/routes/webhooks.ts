/**
 * Webhooks & Workflow Routes
 *
 * POST /api/webhooks/glados  — manually trigger a GLaDOS webhook
 * GET  /api/workflow/:itemId — get the workflow status for a board item
 */

import type { FastifyInstance } from 'fastify';
import type { WorkflowService } from '../workflow-service.js';
import type { BoardPhase } from '../../../shared/grammar/types.js';
import { PHASE_ORDER } from '../../../shared/grammar/types.js';

const VALID_PHASES = new Set<string>(PHASE_ORDER);

function isBoardPhase(value: unknown): value is BoardPhase {
  return typeof value === 'string' && VALID_PHASES.has(value);
}

export function webhookRoutes(app: FastifyInstance, workflowService: WorkflowService): void {
  // POST /api/webhooks/glados
  app.post<{
    Body: {
      itemId?: unknown;
      phase?: unknown;
    };
  }>('/api/webhooks/glados', async (request, reply) => {
    const { itemId, phase } = request.body ?? {};

    if (typeof itemId !== 'string' || !itemId.trim()) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Request body must include "itemId" (non-empty string)',
      });
    }

    if (!isBoardPhase(phase)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `"phase" must be a valid board phase; got: ${JSON.stringify(phase)}`,
      });
    }

    workflowService.triggerWorkflow(itemId, phase);
    return reply.status(202).send({ accepted: true });
  });

  // GET /api/workflow/:itemId
  app.get<{
    Params: { itemId: string };
  }>('/api/workflow/:itemId', async (request, reply) => {
    const { itemId } = request.params;
    const status = workflowService.getStatus(itemId);
    return reply.status(200).send(status);
  });
}
