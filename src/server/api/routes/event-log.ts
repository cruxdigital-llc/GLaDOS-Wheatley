/**
 * Event Log Routes
 *
 * GET /api/events/log — retrieve persisted event history
 */

import type { FastifyInstance } from 'fastify';
import type { EventLogService } from '../event-log-service.js';

export function eventLogRoutes(app: FastifyInstance, eventLogService: EventLogService): void {
  app.get<{
    Querystring: { limit?: string };
  }>('/api/events/log', async (request) => {
    const limit = request.query.limit ? parseInt(request.query.limit, 10) : undefined;
    const events = await eventLogService.getEvents(limit);
    return { events };
  });
}
