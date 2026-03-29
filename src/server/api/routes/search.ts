/**
 * Search Routes
 *
 * GET /api/search?q=<query>&branch=<branch> — full-text search across board cards
 */

import type { FastifyInstance } from 'fastify';
import type { SearchService } from '../search-service.js';

const MAX_QUERY_LENGTH = 200;

export function searchRoutes(app: FastifyInstance, searchService: SearchService): void {
  app.get<{
    Querystring: { q?: string; branch?: string };
  }>('/api/search', async (request, reply) => {
    const { q, branch } = request.query;

    if (!q || !q.trim()) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Query parameter "q" is required',
      });
    }

    if (q.length > MAX_QUERY_LENGTH) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `Query too long (max ${MAX_QUERY_LENGTH} chars)`,
      });
    }

    const results = await searchService.search(q, branch || undefined);

    return {
      results,
      total: results.length,
    };
  });
}
