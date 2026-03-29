/**
 * Card Management Routes
 *
 * POST   /api/cards           — create a new card
 * PUT    /api/cards/:id/title — rename a card
 * DELETE /api/cards/:id       — archive/delete a card
 */

import type { FastifyInstance } from 'fastify';
import type { CardService } from '../card-service.js';
import { CardNotFoundError } from '../card-service.js';
import type { BoardPhase } from '../../../shared/grammar/types.js';
import { PHASE_ORDER } from '../../../shared/grammar/types.js';

const VALID_PHASES = new Set<string>(PHASE_ORDER);
const TITLE_MAX_LENGTH = 200;
const SAFE_ID_RE = /^\d+\.\d+\.\d+$/;

export function cardRoutes(app: FastifyInstance, cardService: CardService): void {
  // POST /api/cards — create a new card
  app.post<{
    Body: {
      title?: unknown;
      phase?: unknown;
      section?: unknown;
      branch?: unknown;
    };
  }>('/api/cards', async (request, reply) => {
    const { title, phase, section, branch } = request.body ?? {};

    if (typeof title !== 'string' || !title.trim()) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'title is required (non-empty string)',
      });
    }

    if (title.length > TITLE_MAX_LENGTH) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `title must be ${TITLE_MAX_LENGTH} characters or fewer`,
      });
    }

    if (phase !== undefined && (typeof phase !== 'string' || !VALID_PHASES.has(phase))) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `Invalid phase: ${JSON.stringify(phase)}`,
      });
    }

    if (section !== undefined && (typeof section !== 'string' || !/^\d+\.\d+$/.test(section))) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'section must be in format "N.N" (e.g., "1.1")',
      });
    }

    const result = await cardService.createCard({
      title: title.trim(),
      phase: phase as BoardPhase | undefined,
      section: section as string | undefined,
      branch: typeof branch === 'string' ? branch : undefined,
    });

    return reply.status(201).send(result);
  });

  // PUT /api/cards/:id/title — rename a card
  app.put<{
    Params: { id: string };
    Body: { title?: unknown; branch?: unknown };
  }>('/api/cards/:id/title', async (request, reply) => {
    const { id } = request.params;
    const { title, branch } = request.body ?? {};

    if (!SAFE_ID_RE.test(id)) {
      return reply.status(400).send({ error: 'Invalid card ID format' });
    }
    if (typeof title !== 'string' || !title.trim()) {
      return reply.status(400).send({ error: 'title is required' });
    }
    if (title.length > TITLE_MAX_LENGTH) {
      return reply.status(400).send({ error: `title must be ${TITLE_MAX_LENGTH} characters or fewer` });
    }

    try {
      await cardService.renameCard(id, title.trim(), typeof branch === 'string' ? branch : undefined);
    } catch (err) {
      if (err instanceof CardNotFoundError) {
        return reply.status(404).send({ error: err.message });
      }
      throw err;
    }
    return reply.status(200).send({ renamed: true, id, title: title.trim() });
  });

  // DELETE /api/cards/:id — archive/delete a card
  app.delete<{
    Params: { id: string };
    Querystring: { branch?: string };
  }>('/api/cards/:id', async (request, reply) => {
    const { id } = request.params;
    const { branch } = request.query;

    if (!SAFE_ID_RE.test(id)) {
      return reply.status(400).send({ error: 'Invalid card ID format' });
    }

    try {
      await cardService.deleteCard(id, branch);
    } catch (err) {
      if (err instanceof CardNotFoundError) {
        return reply.status(404).send({ error: err.message });
      }
      throw err;
    }
    return reply.status(200).send({ deleted: true, id });
  });
}
