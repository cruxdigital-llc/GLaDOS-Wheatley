/**
 * Claims Routes
 *
 * POST   /api/claims         — claim a task
 * DELETE /api/claims/:id     — release a claim
 */

import type { FastifyInstance } from 'fastify';
import {
  ClaimService,
  AlreadyClaimedError,
  NotClaimedError,
  ForbiddenError,
  ConflictError,
} from '../claim-service.js';

export function claimsRoutes(app: FastifyInstance, claimService: ClaimService): void {
  // POST /api/claims
  app.post<{
    Body: { itemId?: unknown; claimant?: unknown };
  }>('/api/claims', async (request, reply) => {
    const { itemId, claimant } = request.body ?? {};

    if (typeof itemId !== 'string' || typeof claimant !== 'string') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Request body must include "itemId" (string) and "claimant" (string)',
      });
    }

    try {
      const entry = await claimService.claimItem(itemId, claimant);
      return reply.status(201).send(entry);
    } catch (err) {
      if (err instanceof ConflictError) {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          message: err.message,
          conflict: true,
        });
      }
      if (err instanceof AlreadyClaimedError) {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          message: err.message,
          conflict: true,
          claim: err.claim,
        });
      }
      if (err instanceof Error && err.message.startsWith('Invalid')) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: err.message,
        });
      }
      throw err;
    }
  });

  // DELETE /api/claims/:id
  app.delete<{
    Params: { id: string };
    Querystring: { claimant?: string };
  }>('/api/claims/:id', async (request, reply) => {
    const { id } = request.params;
    const claimant = request.query.claimant || undefined;

    try {
      const entry = await claimService.releaseItem(id, claimant);
      return reply.status(200).send(entry);
    } catch (err) {
      if (err instanceof ConflictError) {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          message: err.message,
          conflict: true,
        });
      }
      if (err instanceof NotClaimedError) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: err.message,
        });
      }
      if (err instanceof ForbiddenError) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: err.message,
        });
      }
      throw err;
    }
  });
}
