/**
 * Card Metadata Routes
 *
 * PUT /api/cards/:id/metadata — update labels, priority, due date
 */

import type { FastifyInstance } from 'fastify';
import type { GitAdapter } from '../../git/types.js';
import { updateFrontmatter } from '../../../shared/parsers/frontmatter-parser.js';

const SAFE_ID_RE = /^\d+\.\d+\.\d+$/;
const VALID_PRIORITIES = new Set(['P0', 'P1', 'P2', 'P3']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_LABELS = 20;
const MAX_LABEL_LENGTH = 50;

/** Directory name must be alphanumeric with hyphens, underscores, and dots only. */
const SAFE_DIR_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;

/**
 * Find the spec directory for a given card ID by listing the specs/ directory
 * and matching against the roadmap item ID embedded in the spec dir name.
 */
async function findSpecDir(
  adapter: GitAdapter,
  cardId: string,
  branch?: string,
): Promise<string | null> {
  const entries = await adapter.listDirectory('specs', branch);
  const slug = cardId.replace(/\./g, '-');

  for (const entry of entries) {
    if (entry.type === 'directory' && entry.name.includes(`_${slug}`)) {
      return entry.name;
    }
  }

  return null;
}

export function metadataRoutes(app: FastifyInstance, adapter: GitAdapter): void {
  app.put<{
    Params: { id: string };
    Body: {
      labels?: unknown;
      priority?: unknown;
      due?: unknown;
      branch?: unknown;
    };
  }>('/api/cards/:id/metadata', async (request, reply) => {
    const { id } = request.params;
    const { labels, priority, due, branch } = request.body ?? {};

    // Validate ID format
    if (!SAFE_ID_RE.test(id)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid card ID format (expected digits.digits.digits)',
      });
    }

    // Validate priority
    if (priority !== undefined && priority !== null) {
      if (typeof priority !== 'string' || !VALID_PRIORITIES.has(priority)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: `Invalid priority: must be one of P0, P1, P2, P3`,
        });
      }
    }

    // Validate due date
    if (due !== undefined && due !== null) {
      if (typeof due !== 'string' || !DATE_RE.test(due)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid due date: must be YYYY-MM-DD format',
        });
      }
    }

    // Validate labels
    if (labels !== undefined && labels !== null) {
      if (!Array.isArray(labels)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'labels must be an array of strings',
        });
      }

      if (labels.length > MAX_LABELS) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: `labels: maximum ${MAX_LABELS} items allowed`,
        });
      }

      for (const label of labels) {
        if (typeof label !== 'string' || !label.trim()) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: 'Each label must be a non-empty string',
          });
        }
        if (label.length > MAX_LABEL_LENGTH) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: `Each label must be ${MAX_LABEL_LENGTH} characters or fewer`,
          });
        }
      }
    }

    const branchStr = typeof branch === 'string' ? branch : undefined;

    // Find the spec directory for this card
    const specDir = await findSpecDir(adapter, id, branchStr);
    if (!specDir) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `No spec directory found for card ${id}`,
      });
    }

    // Validate spec dir name (defense in depth)
    if (!SAFE_DIR_RE.test(specDir)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid spec directory name',
      });
    }

    const readmePath = `specs/${specDir}/README.md`;

    // Read existing README.md
    const existing = await adapter.readFile(readmePath, branchStr);
    if (existing === null) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `README.md not found in spec directory ${specDir}`,
      });
    }

    // Build the partial metadata update
    const update: Record<string, unknown> = {};
    if (labels !== undefined) {
      update.labels = labels as string[];
    }
    if (priority !== undefined) {
      update.priority = priority;
    }
    if (due !== undefined) {
      update.due = due;
    }

    // Update frontmatter
    const updated = updateFrontmatter(existing, update as Record<string, string[] | string | null>);

    // Write back
    await adapter.writeFile(
      readmePath,
      updated,
      `wheatley: update metadata for ${id}`,
      branchStr,
    );

    return reply.status(200).send({ updated: true });
  });
}
