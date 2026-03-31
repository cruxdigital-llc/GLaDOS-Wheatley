/**
 * Conformance Route
 *
 * GET /api/conformance — analyze repo conformance to parsing grammar
 */

import type { FastifyInstance } from 'fastify';
import type { GitAdapter } from '../../git/types.js';
import { analyzeConformance } from '../../conformance/analyzer.js';

export function conformanceRoutes(app: FastifyInstance, adapter: GitAdapter): void {
  app.get<{ Querystring: { branch?: string } }>('/api/conformance', async (request) => {
    const branch = request.query.branch || undefined;
    return analyzeConformance(adapter, branch);
  });
}
