/**
 * Sync & SSE Routes
 *
 * POST /api/sync       — trigger git fetch + emit board-updated event
 * GET  /api/events     — SSE stream of board change events
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { GitAdapter } from '../../git/types.js';
import type { EventBus } from '../event-bus.js';

/** Max concurrent SSE connections. */
const MAX_SSE_CONNECTIONS = 100;

/** Webhook secret from env. When set, requests without valid signature are rejected. */
const WEBHOOK_SECRET = process.env['WHEATLEY_WEBHOOK_SECRET'] ?? '';

function verifyGitHubSignature(payload: string, signature: string | undefined): boolean {
  if (!WEBHOOK_SECRET) return true; // No secret configured — allow all
  if (!signature) return false;
  const expected = 'sha256=' + createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

function verifyGitLabToken(token: string | undefined): boolean {
  if (!WEBHOOK_SECRET) return true; // No secret configured — allow all
  if (!token) return false;
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(WEBHOOK_SECRET));
  } catch {
    return false;
  }
}

export function syncRoutes(app: FastifyInstance, adapter: GitAdapter, eventBus: EventBus): void {
  let activeSSEConnections = 0;

  // POST /api/sync — manual sync trigger
  app.post('/api/sync', async (_request, reply) => {
    try {
      await adapter.fetchOrigin();

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
    if (activeSSEConnections >= MAX_SSE_CONNECTIONS) {
      return reply.status(503).send({ error: 'Too many SSE connections' });
    }

    activeSSEConnections++;
    const raw = reply.raw;
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    raw.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

    const keepAlive = setInterval(() => {
      raw.write(': ping\n\n');
    }, 30_000);

    const unsubscribe = eventBus.subscribe((event) => {
      raw.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    request.raw.on('close', () => {
      activeSSEConnections--;
      clearInterval(keepAlive);
      unsubscribe();
    });

    await reply.hijack();
  });

  // POST /api/webhooks/github — accept GitHub push events
  app.post<{ Body: { ref?: string; repository?: { full_name?: string } } }>(
    '/api/webhooks/github',
    { config: { rawBody: true } },
    async (request, reply) => {
      const signature = request.headers['x-hub-signature-256'] as string | undefined;
      const rawBody = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
      if (!verifyGitHubSignature(rawBody, signature)) {
        return reply.status(401).send({ error: 'Invalid signature' });
      }

      const { ref, repository } = request.body ?? {};
      const branch = typeof ref === 'string' ? ref.replace('refs/heads/', '') : undefined;

      eventBus.emit({
        type: 'webhook',
        timestamp: new Date().toISOString(),
        detail: `GitHub push: ${repository?.full_name ?? 'unknown'}${branch ? ` (${branch})` : ''}`,
      });

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
      const token = request.headers['x-gitlab-token'] as string | undefined;
      if (!verifyGitLabToken(token)) {
        return reply.status(401).send({ error: 'Invalid token' });
      }

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
