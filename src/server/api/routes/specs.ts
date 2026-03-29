/**
 * Spec Editing Routes
 *
 * PUT /api/specs/:specDir/:fileName — save a spec file
 */

import type { FastifyInstance } from 'fastify';
import type { GitAdapter } from '../../git/types.js';

/** Only allow editing known spec file types. */
const ALLOWED_FILES = new Set([
  'README.md', 'spec.md', 'plan.md', 'requirements.md', 'tasks.md', 'comments.md',
]);

/** Directory name must be alphanumeric with hyphens, underscores, and dots only. */
const SAFE_DIR_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;

/** Maximum content size: 100 KB. */
const MAX_CONTENT_LENGTH = 100_000;

export function specRoutes(app: FastifyInstance, adapter: GitAdapter): void {
  app.put<{
    Params: { specDir: string; fileName: string };
    Body: { content?: unknown; branch?: unknown };
  }>('/api/specs/:specDir/:fileName', async (request, reply) => {
    const { specDir, fileName } = request.params;
    const { content, branch } = request.body ?? {};

    // Reject path traversal sequences before any other processing
    if (specDir.includes('..') || specDir.includes('/') || specDir.includes('\\')) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid spec directory name',
      });
    }

    // Validate specDir format
    if (!SAFE_DIR_RE.test(specDir)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid spec directory name',
      });
    }

    if (!ALLOWED_FILES.has(fileName)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `File not editable: ${fileName}. Allowed: ${[...ALLOWED_FILES].join(', ')}`,
      });
    }

    if (typeof content !== 'string') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'content must be a string',
      });
    }

    if (content.length > MAX_CONTENT_LENGTH) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `Content too large (max ${MAX_CONTENT_LENGTH} bytes)`,
      });
    }

    const filePath = `specs/${specDir}/${fileName}`;
    const branchStr = typeof branch === 'string' ? branch : undefined;

    await adapter.writeFile(
      filePath,
      content,
      `wheatley: update ${specDir}/${fileName}`,
      branchStr,
    );

    return reply.status(200).send({ saved: true, path: filePath });
  });
}
