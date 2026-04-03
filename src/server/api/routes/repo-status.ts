/**
 * Repo Status Routes
 *
 * GET  /api/repo/status — working tree state, push status, GPG warnings
 * POST /api/repo/push   — push unpushed worktree commits to origin
 */

import type { FastifyInstance } from 'fastify';
import type { GitAdapter } from '../../git/types.js';

export function repoStatusRoutes(app: FastifyInstance, adapter: GitAdapter): void {
  app.get('/api/repo/status', async () => {
    return adapter.getRepoStatus();
  });

  app.post('/api/repo/push', async (_request, reply) => {
    if (!adapter.push) {
      return reply.status(501).send({ error: 'Push not supported for this adapter' });
    }

    try {
      const result = await adapter.push();
      return reply.status(200).send(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Push failed';

      // Enhance error message for common credential issues
      if (message.includes('could not read Username') || message.includes('Authentication failed')) {
        return reply.status(401).send({
          error: 'Push failed: no git credentials configured.',
          hint: 'Set GITHUB_TOKEN environment variable or mount SSH keys via Docker volume.',
        });
      }

      return reply.status(500).send({ error: message });
    }
  });
}
