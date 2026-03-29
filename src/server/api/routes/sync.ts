/**
 * Sync & SSE Routes
 *
 * POST /api/sync       — trigger git fetch + emit board-updated event
 * GET  /api/events     — SSE stream of board change events
 */

import type { FastifyInstance } from 'fastify';
import type { GitAdapter } from '../../git/types.js';
import type { EventBus } from '../event-bus.js';

export function syncRoutes(app: FastifyInstance, adapter: GitAdapter, eventBus: EventBus): void {
  // POST /api/sync — manual sync trigger
  app.post('/api/sync', async (_request, reply) => {
    try {
      // For local adapter, fetch latest from origin
      // The adapter's readFile already reads from git refs, so just fetching is enough
      // We rely on the adapter's internal git instance
      await adapter.getLatestSha(); // Forces any internal refresh

      eventBus.emit({
        type: 'sync',
        timestamp: new Date().toISOString(),
        detail: 'Manual sync triggered',
      });

      return reply.status(200).send({ synced: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ error: message });
    }
  });

  // GET /api/events — SSE endpoint
  app.get('/api/events', async (request, reply) => {
    const raw = reply.raw;
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Send initial connection event
    raw.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

    // Keep-alive ping every 30s
    const keepAlive = setInterval(() => {
      raw.write(': ping\n\n');
    }, 30_000);

    // Subscribe to events
    const unsubscribe = eventBus.subscribe((event) => {
      raw.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    // Clean up on disconnect
    request.raw.on('close', () => {
      clearInterval(keepAlive);
      unsubscribe();
    });

    // Prevent Fastify from sending a response (we're handling raw)
    await reply.hijack();
  });

  // POST /api/webhooks/github — accept GitHub push events
  app.post<{ Body: { ref?: string; repository?: { full_name?: string } } }>(
    '/api/webhooks/github',
    async (request, reply) => {
      const { ref, repository } = request.body ?? {};
      const branch = typeof ref === 'string' ? ref.replace('refs/heads/', '') : undefined;

      eventBus.emit({
        type: 'webhook',
        timestamp: new Date().toISOString(),
        detail: `GitHub push: ${repository?.full_name ?? 'unknown'}${branch ? ` (${branch})` : ''}`,
      });

      // Trigger a sync
      eventBus.emit({
        type: 'board-updated',
        timestamp: new Date().toISOString(),
      });

      return reply.status(200).send({ received: true });
    },
  );

  // POST /api/webhooks/gitlab — accept GitLab push events
  app.post<{ Body: { ref?: string; project?: { path_with_namespace?: string } } }>(
    '/api/webhooks/gitlab',
    async (request, reply) => {
      const { ref, project } = request.body ?? {};
      const branch = typeof ref === 'string' ? ref.replace('refs/heads/', '') : undefined;

      eventBus.emit({
        type: 'webhook',
        timestamp: new Date().toISOString(),
        detail: `GitLab push: ${project?.path_with_namespace ?? 'unknown'}${branch ? ` (${branch})` : ''}`,
      });

      eventBus.emit({
        type: 'board-updated',
        timestamp: new Date().toISOString(),
      });

      return reply.status(200).send({ received: true });
    },
  );
}
