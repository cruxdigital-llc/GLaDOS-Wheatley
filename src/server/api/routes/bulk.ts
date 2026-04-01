/**
 * Bulk Operations Routes
 *
 * POST /api/bulk/move       — transition multiple cards to a target phase
 * POST /api/bulk/assign     — claim or reassign multiple cards
 * POST /api/bulk/metadata   — update labels/priority for multiple cards
 * POST /api/bulk/delete     — delete multiple cards
 */

import type { FastifyInstance } from 'fastify';
import type { CardService } from '../card-service.js';
import type { ClaimService } from '../claim-service.js';
import type { TransitionService } from '../transition-service.js';
import type { GitAdapter } from '../../git/types.js';
import type { BoardPhase } from '../../../shared/grammar/types.js';
import { updateFrontmatter } from '../../../shared/parsers/frontmatter-parser.js';

const SAFE_ID_RE = /^\d+\.\d+\.\d+$/;
const VALID_PHASES = new Set<string>(['unclaimed', 'planning', 'speccing', 'implementing', 'verifying', 'done']);
const VALID_PRIORITIES = new Set<string>(['P0', 'P1', 'P2', 'P3']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SAFE_LABEL_RE = /^[a-zA-Z0-9][a-zA-Z0-9 _-]*$/;
const SAFE_BRANCH_RE = /^[a-zA-Z0-9][a-zA-Z0-9._\/-]*$/;
const MAX_BULK_SIZE = 50;
const MAX_LABELS = 20;

function validateIds(ids: unknown): string[] | null {
  if (!Array.isArray(ids)) return null;
  if (ids.length === 0 || ids.length > MAX_BULK_SIZE) return null;
  for (const id of ids) {
    if (typeof id !== 'string' || !SAFE_ID_RE.test(id)) return null;
  }
  return ids as string[];
}

export function bulkRoutes(
  app: FastifyInstance,
  cardService: CardService,
  claimService: ClaimService,
  transitionService: TransitionService,
  adapter: GitAdapter,
): void {
  // POST /api/bulk/move — transition multiple cards
  app.post<{
    Body: {
      cardIds?: unknown;
      from?: unknown;
      to?: unknown;
      branch?: unknown;
    };
  }>('/api/bulk/move', async (request, reply) => {
    const { cardIds, from, to, branch } = request.body ?? {};

    const ids = validateIds(cardIds);
    if (!ids) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `cardIds must be an array of 1-${MAX_BULK_SIZE} valid card IDs`,
      });
    }

    if (typeof from !== 'string' || !VALID_PHASES.has(from)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'from must be a valid phase',
      });
    }

    if (typeof to !== 'string' || !VALID_PHASES.has(to)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'to must be a valid phase',
      });
    }

    const branchStr = typeof branch === 'string' ? branch : undefined;
    if (branchStr && (!SAFE_BRANCH_RE.test(branchStr) || branchStr.includes('..'))) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid branch name' });
    }
    const results: Array<{ id: string; success: boolean; error?: string }> = [];

    for (const id of ids) {
      try {
        await transitionService.executeTransition(
          id,
          from as BoardPhase,
          to as BoardPhase,
          branchStr,
        );
        results.push({ id, success: true });
      } catch (err) {
        results.push({
          id,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return reply.status(200).send({ results });
  });

  // POST /api/bulk/assign — claim multiple cards
  app.post<{
    Body: {
      cardIds?: unknown;
      claimant?: unknown;
    };
  }>('/api/bulk/assign', async (request, reply) => {
    const { cardIds, claimant } = request.body ?? {};

    const ids = validateIds(cardIds);
    if (!ids) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `cardIds must be an array of 1-${MAX_BULK_SIZE} valid card IDs`,
      });
    }

    if (typeof claimant !== 'string' || !claimant.trim()) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'claimant must be a non-empty string',
      });
    }

    const results: Array<{ id: string; success: boolean; error?: string }> = [];

    for (const id of ids) {
      try {
        await claimService.claimItem(id, claimant.trim());
        results.push({ id, success: true });
      } catch (err) {
        results.push({
          id,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return reply.status(200).send({ results });
  });

  // POST /api/bulk/metadata — update labels/priority for multiple cards
  app.post<{
    Body: {
      cardIds?: unknown;
      labels?: unknown;
      priority?: unknown;
      due?: unknown;
      branch?: unknown;
    };
  }>('/api/bulk/metadata', async (request, reply) => {
    const { cardIds, labels, priority, due, branch } = request.body ?? {};

    const ids = validateIds(cardIds);
    if (!ids) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `cardIds must be an array of 1-${MAX_BULK_SIZE} valid card IDs`,
      });
    }

    const branchStr = typeof branch === 'string' ? branch : undefined;
    if (branchStr && (!SAFE_BRANCH_RE.test(branchStr) || branchStr.includes('..'))) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid branch name' });
    }

    // Validate metadata values
    if (priority !== undefined && priority !== null) {
      if (typeof priority !== 'string' || !VALID_PRIORITIES.has(priority)) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'priority must be P0, P1, P2, or P3' });
      }
    }
    if (due !== undefined && due !== null) {
      if (typeof due !== 'string' || !DATE_RE.test(due)) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'due must be YYYY-MM-DD format' });
      }
    }
    if (labels !== undefined && labels !== null) {
      if (!Array.isArray(labels) || labels.length > MAX_LABELS) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: `labels must be an array (max ${MAX_LABELS})` });
      }
      for (const l of labels) {
        if (typeof l !== 'string' || !SAFE_LABEL_RE.test(l.trim())) {
          return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid label format' });
        }
      }
    }

    const update: Record<string, unknown> = {};
    if (labels !== undefined) update.labels = labels;
    if (priority !== undefined) update.priority = priority;
    if (due !== undefined) update.due = due;

    // Load spec directory listing once (not per-card)
    const specEntries = await adapter.listDirectory('specs', branchStr);
    const results: Array<{ id: string; success: boolean; error?: string }> = [];

    for (const id of ids) {
      try {
        const slug = id.replace(/\./g, '-');
        const specDir = specEntries.find(
          (e) => e.type === 'directory' && e.name.includes(`_${slug}`),
        )?.name;

        if (!specDir) {
          results.push({ id, success: false, error: 'No spec directory found' });
          continue;
        }

        const readmePath = `specs/${specDir}/README.md`;
        const existing = await adapter.readFile(readmePath, branchStr);
        if (existing === null) {
          results.push({ id, success: false, error: 'README.md not found' });
          continue;
        }

        const updated = updateFrontmatter(existing, update as Record<string, string[] | string | null>);
        await adapter.writeFile(
          readmePath,
          updated,
          `wheatley: bulk update metadata for ${id}`,
          branchStr,
        );
        results.push({ id, success: true });
      } catch (err) {
        results.push({
          id,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return reply.status(200).send({ results });
  });

  // POST /api/bulk/delete — delete multiple cards
  app.post<{
    Body: {
      cardIds?: unknown;
      branch?: unknown;
    };
  }>('/api/bulk/delete', async (request, reply) => {
    const { cardIds, branch } = request.body ?? {};

    const ids = validateIds(cardIds);
    if (!ids) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `cardIds must be an array of 1-${MAX_BULK_SIZE} valid card IDs`,
      });
    }

    const branchStr = typeof branch === 'string' ? branch : undefined;
    if (branchStr && (!SAFE_BRANCH_RE.test(branchStr) || branchStr.includes('..'))) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid branch name' });
    }
    const results: Array<{ id: string; success: boolean; error?: string }> = [];

    for (const id of ids) {
      try {
        await cardService.deleteCard(id, branchStr);
        results.push({ id, success: true });
      } catch (err) {
        results.push({
          id,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return reply.status(200).send({ results });
  });

  // POST /api/bulk/archive — archive multiple done cards
  app.post<{
    Body: {
      cardIds?: unknown;
      branch?: unknown;
    };
  }>('/api/bulk/archive', async (request, reply) => {
    const { cardIds, branch } = request.body ?? {};

    const ids = validateIds(cardIds);
    if (!ids) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `cardIds must be an array of 1-${MAX_BULK_SIZE} valid card IDs`,
      });
    }

    const branchStr = typeof branch === 'string' ? branch : undefined;
    if (branchStr && (!SAFE_BRANCH_RE.test(branchStr) || branchStr.includes('..'))) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid branch name' });
    }
    const results: Array<{ id: string; success: boolean; specDir?: string; error?: string }> = [];

    for (const id of ids) {
      try {
        const result = await cardService.archiveCard(id, branchStr);
        results.push({ id, success: true, specDir: result.specDir });
      } catch (err) {
        results.push({
          id,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return reply.status(200).send({ results });
  });
}
