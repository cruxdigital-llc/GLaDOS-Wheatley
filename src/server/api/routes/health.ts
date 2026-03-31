/**
 * Health Check Route
 */

import type { FastifyInstance } from 'fastify';

export function healthRoutes(app: FastifyInstance): void {
  app.get('/api/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });
}
