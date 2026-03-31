/**
 * Repo Status Route
 *
 * Reports working tree state: dirty files, merge conflicts, worktree isolation status.
 */

import type { FastifyInstance } from 'fastify';
import type { GitAdapter } from '../../git/types.js';

export function repoStatusRoutes(app: FastifyInstance, adapter: GitAdapter): void {
  app.get('/api/repo/status', async () => {
    return adapter.getRepoStatus();
  });
}
