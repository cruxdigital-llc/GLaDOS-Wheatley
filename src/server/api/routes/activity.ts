/**
 * Activity Routes
 *
 * GET /api/activity — read the global activity feed
 * POST /api/activity — record a new trace entry
 */

import type { FastifyInstance } from 'fastify';
import type { ActivityService } from '../activity-service.js';
import type { TraceAction } from '../../../shared/grammar/types.js';

const VALID_ACTIONS = new Set<string>([
  'claim', 'release', 'transition', 'file-create', 'file-edit', 'commit', 'comment',
]);

export function activityRoutes(app: FastifyInstance, activityService: ActivityService): void {
  // GET /api/activity?limit=50&actor=jed&action=claim&branch=main
  app.get('/api/activity', async (request, reply) => {
    const query = request.query as Record<string, string | undefined>;

    const limit = query.limit ? parseInt(query.limit, 10) : undefined;
    if (limit !== undefined && (isNaN(limit) || limit < 1)) {
      return reply.status(400).send({ error: 'Bad Request', message: 'limit must be a positive integer' });
    }

    const action = query.action;
    if (action && !VALID_ACTIONS.has(action)) {
      return reply.status(400).send({ error: 'Bad Request', message: `Invalid action: ${action}` });
    }

    const feed = await activityService.getActivityFeed({
      limit,
      actor: query.actor,
      action: action as TraceAction | undefined,
      branch: query.branch,
    });

    // Convert actors Map to plain object for JSON serialization
    const actorsObj: Record<string, string> = {};
    for (const [name, type] of feed.actors) {
      actorsObj[name] = type;
    }

    return { entries: feed.entries, actors: actorsObj };
  });

  // POST /api/activity
  app.post('/api/activity', async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;

    if (!body || typeof body !== 'object') {
      return reply.status(400).send({ error: 'Bad Request', message: 'Body required' });
    }

    const { action, target, actor, detail, branch } = body as {
      action?: string;
      target?: string;
      actor?: string;
      detail?: string;
      branch?: string;
    };

    if (!action || !VALID_ACTIONS.has(action)) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Valid action required' });
    }
    if (!target || typeof target !== 'string') {
      return reply.status(400).send({ error: 'Bad Request', message: 'target required' });
    }
    if (!actor || typeof actor !== 'string') {
      return reply.status(400).send({ error: 'Bad Request', message: 'actor required' });
    }

    const entry = await activityService.recordTrace(
      action as TraceAction,
      target,
      actor,
      typeof detail === 'string' ? detail : undefined,
      typeof branch === 'string' ? branch : undefined,
    );

    return reply.status(201).send(entry);
  });
}
