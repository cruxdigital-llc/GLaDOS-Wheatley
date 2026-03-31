/**
 * Notification Routes
 *
 * GET  /api/notifications/webhooks    — list configured webhooks
 * POST /api/notifications/webhooks    — add a webhook
 * DELETE /api/notifications/webhooks/:id — remove a webhook
 * GET  /api/notifications/events      — get event log
 */

import type { FastifyInstance } from 'fastify';
import type { NotificationService, WebhookConfig, EventType } from '../notification-service.js';

const VALID_FORMATS = new Set(['raw', 'slack']);
const VALID_EVENT_TYPES = new Set<string>([
  'claim', 'release', 'transition', 'conflict', 'ttl-warning', 'ttl-expired',
]);
const MAX_WEBHOOKS = 50;

export function notificationRoutes(
  app: FastifyInstance,
  notificationService: NotificationService,
): void {
  // GET /api/notifications/webhooks
  app.get('/api/notifications/webhooks', async () => {
    return { webhooks: notificationService.listWebhooks() };
  });

  // POST /api/notifications/webhooks
  app.post('/api/notifications/webhooks', async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') {
      return reply.status(400).send({ error: 'Bad Request', message: 'Body required' });
    }

    const { id, url, events, format } = body as {
      id?: string;
      url?: string;
      events?: string[];
      format?: string;
    };

    if (!id || typeof id !== 'string') {
      return reply.status(400).send({ error: 'Bad Request', message: 'id required (string)' });
    }
    if (!url || typeof url !== 'string') {
      return reply.status(400).send({ error: 'Bad Request', message: 'url required (string)' });
    }
    // Reject non-HTTPS webhook URLs to prevent SSRF
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return reply.status(400).send({ error: 'Bad Request', message: 'url must be a valid URL' });
    }
    if (parsedUrl.protocol !== 'https:') {
      return reply.status(400).send({ error: 'Bad Request', message: 'url must use HTTPS' });
    }
    // Enforce max webhooks limit
    if (notificationService.listWebhooks().length >= MAX_WEBHOOKS) {
      return reply.status(400).send({ error: 'Bad Request', message: `Maximum of ${MAX_WEBHOOKS} webhooks reached` });
    }
    if (format && !VALID_FORMATS.has(format)) {
      return reply.status(400).send({ error: 'Bad Request', message: 'format must be "raw" or "slack"' });
    }

    const eventList = Array.isArray(events)
      ? events.filter((e): e is EventType => VALID_EVENT_TYPES.has(e))
      : [];

    const config: WebhookConfig = {
      id,
      url,
      events: eventList,
      active: true,
      format: (format as 'raw' | 'slack') ?? 'raw',
    };

    notificationService.addWebhook(config);
    return reply.status(201).send(config);
  });

  // DELETE /api/notifications/webhooks/:id
  app.delete<{ Params: { id: string } }>(
    '/api/notifications/webhooks/:id',
    async (request, reply) => {
      const removed = notificationService.removeWebhook(request.params.id);
      if (!removed) {
        return reply.status(404).send({ error: 'Not Found', message: 'Webhook not found' });
      }
      return { ok: true };
    },
  );

  // GET /api/notifications/events?limit=50
  app.get('/api/notifications/events', async (request) => {
    const query = request.query as Record<string, string | undefined>;
    const limit = query.limit ? parseInt(query.limit, 10) : undefined;
    return { events: notificationService.getEventLog(limit) };
  });
}
