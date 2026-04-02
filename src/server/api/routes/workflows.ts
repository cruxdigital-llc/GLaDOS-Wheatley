/**
 * Workflow Run Routes
 *
 * POST   /api/workflows              — start a GLaDOS workflow
 * GET    /api/workflows              — list active runs
 * GET    /api/workflows/:runId       — get workflow state
 * GET    /api/workflows/:runId/output — get output lines
 * DELETE /api/workflows/:runId       — cancel a workflow
 */

import type { FastifyInstance } from 'fastify';
import type { WorkflowRunner, WorkflowType } from '../../workflows/types.js';

const VALID_TYPES = new Set<string>(['plan', 'spec', 'implement', 'verify']);
const SAFE_CARD_ID_RE = /^\d+\.\d+\.\d+$/;
const RUN_ID_RE = /^wf-\d+-[a-f0-9]+$/;

export function workflowRunRoutes(app: FastifyInstance, runner: WorkflowRunner): void {
  // POST /api/workflows — start a workflow
  app.post<{
    Body: {
      cardId?: unknown;
      type?: unknown;
      specDir?: unknown;
      branch?: unknown;
      mode?: unknown;
    };
  }>('/api/workflows', async (request, reply) => {
    const { cardId, type, specDir, branch } = request.body ?? {};

    if (typeof cardId !== 'string' || !SAFE_CARD_ID_RE.test(cardId)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'cardId must be in format "N.N.N" (e.g., "1.1.1")',
      });
    }

    if (typeof type !== 'string' || !VALID_TYPES.has(type)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `type must be one of: ${[...VALID_TYPES].join(', ')}`,
      });
    }

    const mode = request.body?.mode;
    if (mode !== undefined && mode !== 'autonomous' && mode !== 'interactive') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'mode must be "autonomous" or "interactive"',
      });
    }

    if (specDir !== undefined) {
      if (
        typeof specDir !== 'string' ||
        specDir.includes('..') ||
        specDir.startsWith('/') ||
        !/^[\w./-]+$/.test(specDir)
      ) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'specDir must contain only alphanumeric, hyphens, underscores, dots, and forward slashes',
        });
      }
    }

    try {
      const runId = await runner.start(type as WorkflowType, {
        cardId,
        specDir: typeof specDir === 'string' ? specDir : undefined,
        branch: typeof branch === 'string' ? branch : undefined,
        mode: typeof mode === 'string' ? (mode as 'autonomous' | 'interactive') : undefined,
      });

      const state = await runner.getState(runId);
      return reply.status(201).send({ runId, state: state?.state ?? 'queued' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start workflow';
      return reply.status(409).send({
        statusCode: 409,
        error: 'Conflict',
        message,
      });
    }
  });

  // GET /api/workflows — list active runs
  app.get('/api/workflows', async (_request, reply) => {
    const runs = await runner.listActive();
    return reply.status(200).send({ runs });
  });

  // GET /api/workflows/:runId — get workflow state
  app.get<{
    Params: { runId: string };
  }>('/api/workflows/:runId', async (request, reply) => {
    const { runId } = request.params;

    if (!RUN_ID_RE.test(runId)) {
      return reply.status(400).send({ error: 'Invalid run ID format' });
    }

    const run = await runner.getState(runId);
    if (!run) {
      return reply.status(404).send({ error: 'Run not found' });
    }
    return reply.status(200).send(run);
  });

  // GET /api/workflows/:runId/output — get output lines
  app.get<{
    Params: { runId: string };
    Querystring: { from?: string };
  }>('/api/workflows/:runId/output', async (request, reply) => {
    const { runId } = request.params;

    if (!RUN_ID_RE.test(runId)) {
      return reply.status(400).send({ error: 'Invalid run ID format' });
    }

    const fromLine = request.query.from !== undefined ? parseInt(request.query.from, 10) : 0;
    if (Number.isNaN(fromLine) || fromLine < 0) {
      return reply.status(400).send({ error: '"from" must be a non-negative integer' });
    }

    const lines = await runner.getOutput(runId, fromLine);
    const allLines = await runner.getOutput(runId, 0);
    const total = allLines.length;

    return reply.status(200).send({ lines, total });
  });

  // POST /api/workflows/:runId/input — send input to a waiting workflow
  app.post<{
    Params: { runId: string };
    Body: { text?: unknown };
  }>('/api/workflows/:runId/input', async (request, reply) => {
    const { runId } = request.params;

    if (!RUN_ID_RE.test(runId)) {
      return reply.status(400).send({ error: 'Invalid run ID format' });
    }

    const { text } = request.body ?? {};
    if (typeof text !== 'string' || text.length === 0) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'text must be a non-empty string',
      });
    }

    try {
      await runner.sendInput(runId, text);
      return reply.status(200).send({ sent: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send input';
      return reply.status(409).send({
        statusCode: 409,
        error: 'Conflict',
        message,
      });
    }
  });

  // DELETE /api/workflows/:runId — cancel a workflow
  app.delete<{
    Params: { runId: string };
  }>('/api/workflows/:runId', async (request, reply) => {
    const { runId } = request.params;

    if (!RUN_ID_RE.test(runId)) {
      return reply.status(400).send({ error: 'Invalid run ID format' });
    }

    await runner.cancel(runId);
    return reply.status(200).send({ cancelled: true });
  });
}
