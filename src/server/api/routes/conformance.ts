/**
 * Conformance Routes
 *
 * GET  /api/conformance     — analyze repo conformance to parsing grammar
 * POST /api/conformance/fix — attempt to auto-fix conformance violations
 */

import type { FastifyInstance } from 'fastify';
import type { GitAdapter } from '../../git/types.js';
import { analyzeConformance, autoFixConformance } from '../../conformance/analyzer.js';

export function conformanceRoutes(app: FastifyInstance, adapter: GitAdapter): void {
  app.get<{ Querystring: { branch?: string } }>('/api/conformance', async (request) => {
    const branch = request.query.branch || undefined;
    return analyzeConformance(adapter, branch);
  });

  app.post<{ Body: { branch?: string } }>('/api/conformance/fix', async (request, reply) => {
    const branch = (request.body as { branch?: string })?.branch || undefined;
    try {
      const result = await autoFixConformance(adapter, branch);
      return reply.status(200).send(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Auto-fix failed';
      return reply.status(500).send({ error: msg });
    }
  });
}
