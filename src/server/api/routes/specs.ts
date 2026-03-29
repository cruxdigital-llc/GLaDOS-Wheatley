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

const SAFE_DIR_RE = /^[a-zA-Z0-9_-]+$/;

export function specRoutes(app: FastifyInstance, adapter: GitAdapter): void {
  app.put<{
    Params: { specDir: string; fileName: string };
    Body: { content?: unknown; branch?: unknown };
  }>('/api/specs/:specDir/:fileName', async (request, reply) => {
    const { specDir, fileName } = request.params;
    const { content, branch } = request.body ?? {};

    // Validate specDir (prevent path traversal)
    if (!SAFE_DIR_RE.test(specDir.replace(/[._]/g, ''))) {
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
