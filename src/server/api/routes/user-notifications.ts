/**
 * Per-User Notification Routes
 *
 * GET  /api/user-notifications             — get current user's notifications
 * GET  /api/user-notifications/count        — get unread count
 * PUT  /api/user-notifications/:id/read     — mark notification as read
 * PUT  /api/user-notifications/read-all     — mark all as read
 * GET  /api/user-notifications/preferences  — get notification preferences
 * PUT  /api/user-notifications/preferences  — update preferences
 */

import type { FastifyInstance } from 'fastify';
import type { UserNotificationService } from '../../notifications/notification-service.js';
import type { NotificationEvent } from '../../notifications/types.js';

const VALID_EVENTS = new Set<string>([
  'claim', 'release', 'transition', 'comment', 'mention', 'workflow',
]);

function getUserId(request: { user?: { id: string } }): string {
  // Auth middleware attaches request.user; default to 'local' only if no user set
  return request.user?.id ?? 'local';
}

export function userNotificationRoutes(
  app: FastifyInstance,
  service: UserNotificationService,
): void {
  // GET /api/user-notifications
  app.get('/api/user-notifications', async (request) => {
    const userId = getUserId(request);
    const query = request.query as Record<string, string | undefined>;
    const unreadOnly = query.unread === 'true';
    const limit = query.limit ? parseInt(query.limit, 10) : undefined;

    const notifications = unreadOnly
      ? service.getUnread(userId)
      : service.getAll(userId, limit && limit > 0 ? limit : undefined);

    return { notifications };
  });

  // GET /api/user-notifications/count
  app.get('/api/user-notifications/count', async (request) => {
    const userId = getUserId(request);
    const unread = service.getUnread(userId);
    return { count: unread.length };
  });

  // PUT /api/user-notifications/:id/read
  app.put<{ Params: { id: string } }>(
    '/api/user-notifications/:id/read',
    async (request, reply) => {
      const userId = getUserId(request);
      const { id } = request.params;
      if (!id || typeof id !== 'string') {
        return reply.status(400).send({ error: 'Bad Request', message: 'Notification ID required' });
      }
      service.markRead(userId, id);
      return { ok: true };
    },
  );

  // PUT /api/user-notifications/read-all
  app.put('/api/user-notifications/read-all', async (request) => {
    const userId = getUserId(request);
    service.markAllRead(userId);
    return { ok: true };
  });

  // GET /api/user-notifications/preferences
  app.get('/api/user-notifications/preferences', async (request) => {
    const userId = getUserId(request);
    return { preferences: service.getPreferences(userId) };
  });

  // PUT /api/user-notifications/preferences
  app.put('/api/user-notifications/preferences', async (request, reply) => {
    const userId = getUserId(request);
    const body = request.body as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') {
      return reply.status(400).send({ error: 'Bad Request', message: 'Body required' });
    }

    const update: Partial<{ events: NotificationEvent[]; channels: { inApp: boolean; email: boolean; slack: boolean } }> = {};

    // Validate events
    if (body.events !== undefined) {
      if (!Array.isArray(body.events)) {
        return reply.status(400).send({ error: 'Bad Request', message: 'events must be an array' });
      }
      update.events = (body.events as string[]).filter(
        (e): e is NotificationEvent => VALID_EVENTS.has(e),
      );
    }

    // Validate channels
    if (body.channels !== undefined) {
      if (typeof body.channels !== 'object' || body.channels === null) {
        return reply.status(400).send({ error: 'Bad Request', message: 'channels must be an object' });
      }
      const ch = body.channels as Record<string, unknown>;
      const current = service.getPreferences(userId);
      update.channels = {
        inApp: typeof ch.inApp === 'boolean' ? ch.inApp : current.channels.inApp,
        email: typeof ch.email === 'boolean' ? ch.email : current.channels.email,
        slack: typeof ch.slack === 'boolean' ? ch.slack : current.channels.slack,
      };
    }

    service.updatePreferences(userId, update);
    return { preferences: service.getPreferences(userId) };
  });
}
