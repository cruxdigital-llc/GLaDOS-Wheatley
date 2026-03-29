/**
 * Git Identity Route
 *
 * Returns the git identity (name, email) for the current repository.
 * Supports override via WHEATLEY_COMMIT_AUTHOR env var (format: "Name <email>").
 */

import type { FastifyInstance } from 'fastify';
import type { GitAdapter } from '../../git/types.js';

function parseAuthorOverride(author: string): { name: string; email: string } | null {
  const match = author.match(/^(.+?)\s*<(.+?)>$/);
  if (match) return { name: match[1].trim(), email: match[2].trim() };
  // If no angle brackets, treat entire string as name
  return { name: author.trim(), email: '' };
}

export function identityRoutes(app: FastifyInstance, adapter: GitAdapter): void {
  app.get('/api/identity', async () => {
    // Check env var override first
    const authorOverride = process.env['WHEATLEY_COMMIT_AUTHOR'];
    if (authorOverride) {
      const parsed = parseAuthorOverride(authorOverride);
      if (parsed) {
        return { name: parsed.name, email: parsed.email, source: 'env' as const };
      }
    }

    // Fall back to git config
    const identity = await adapter.getGitIdentity();
    return {
      name: identity.name,
      email: identity.email,
      source: 'git-config' as const,
    };
  });
}
