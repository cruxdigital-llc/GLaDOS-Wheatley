/**
 * Pull Request Routes
 *
 * GET    /api/prs              — list PRs (optional ?branch= filter)
 * GET    /api/prs/:number      — get single PR detail
 * POST   /api/prs              — create a new PR
 * POST   /api/prs/:number/reviewers — request reviews
 * PUT    /api/prs/:number/merge     — merge a PR
 * GET    /api/prs/card/:cardId      — find PRs linked to a card
 */

import type { FastifyInstance } from 'fastify';
import type { PlatformAdapter, MergeStrategy } from '../../platforms/types.js';
import type { PRLinkService } from '../pr-link-service.js';

const VALID_STRATEGIES = new Set<MergeStrategy>(['merge', 'squash', 'rebase']);

function parsePRNumber(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

export function pullRequestRoutes(
  app: FastifyInstance,
  platformAdapter: PlatformAdapter,
  prLinkService: PRLinkService,
): void {
  // GET /api/prs/card/:cardId  (registered before :number to avoid route collision)
  app.get<{
    Params: { cardId: string };
  }>('/api/prs/card/:cardId', async (request, reply) => {
    const { cardId } = request.params;
    if (!/^\d+\.\d+\.\d+$/.test(cardId)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `Invalid card ID format: "${cardId}"`,
      });
    }
    const prs = await prLinkService.findPRsForCard(cardId);
    return prs;
  });

  // GET /api/prs
  app.get<{
    Querystring: { branch?: string };
  }>('/api/prs', async (request) => {
    const branch = request.query.branch || undefined;
    return platformAdapter.listPRs(branch);
  });

  // GET /api/prs/:number
  app.get<{
    Params: { number: string };
  }>('/api/prs/:number', async (request, reply) => {
    const prNum = parsePRNumber(request.params.number);
    if (prNum === null) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'PR number must be a positive integer',
      });
    }
    const pr = await platformAdapter.getPR(prNum);
    if (!pr) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `PR #${prNum} not found`,
      });
    }
    return pr;
  });

  // POST /api/prs
  app.post<{
    Body: {
      title?: unknown;
      description?: unknown;
      sourceBranch?: unknown;
      targetBranch?: unknown;
      draft?: unknown;
    };
  }>('/api/prs', async (request, reply) => {
    const { title, description, sourceBranch, targetBranch, draft } = request.body ?? {};

    if (typeof title !== 'string' || !title.trim()) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: '"title" is required and must be a non-empty string',
      });
    }
    if (typeof sourceBranch !== 'string' || !sourceBranch.trim()) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: '"sourceBranch" is required and must be a non-empty string',
      });
    }
    if (typeof targetBranch !== 'string' || !targetBranch.trim()) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: '"targetBranch" is required and must be a non-empty string',
      });
    }

    try {
      const pr = await platformAdapter.createPR({
        title: title.trim(),
        description: typeof description === 'string' ? description : '',
        sourceBranch: sourceBranch.trim(),
        targetBranch: targetBranch.trim(),
        draft: draft === true,
      });
      return reply.status(201).send(pr);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('No platform configured')) {
        return reply.status(501).send({
          statusCode: 501,
          error: 'Not Implemented',
          message,
        });
      }
      throw err;
    }
  });

  // POST /api/prs/:number/reviewers
  app.post<{
    Params: { number: string };
    Body: { reviewers?: unknown };
  }>('/api/prs/:number/reviewers', async (request, reply) => {
    const prNum = parsePRNumber(request.params.number);
    if (prNum === null) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'PR number must be a positive integer',
      });
    }

    const { reviewers } = request.body ?? {};
    if (!Array.isArray(reviewers) || reviewers.length === 0 || !reviewers.every((r) => typeof r === 'string')) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: '"reviewers" must be a non-empty array of strings',
      });
    }

    try {
      await platformAdapter.requestReview(prNum, reviewers as string[]);
      return reply.status(204).send();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('No platform configured')) {
        return reply.status(501).send({
          statusCode: 501,
          error: 'Not Implemented',
          message,
        });
      }
      throw err;
    }
  });

  // PUT /api/prs/:number/merge
  app.put<{
    Params: { number: string };
    Body: { strategy?: unknown };
  }>('/api/prs/:number/merge', async (request, reply) => {
    const prNum = parsePRNumber(request.params.number);
    if (prNum === null) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'PR number must be a positive integer',
      });
    }

    const strategy = (request.body?.strategy ?? 'merge') as string;
    if (!VALID_STRATEGIES.has(strategy as MergeStrategy)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `Invalid merge strategy "${strategy}". Must be one of: merge, squash, rebase`,
      });
    }

    try {
      await platformAdapter.mergePR(prNum, strategy as MergeStrategy);
      return reply.status(204).send();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('No platform configured')) {
        return reply.status(501).send({
          statusCode: 501,
          error: 'Not Implemented',
          message,
        });
      }
      throw err;
    }
  });
}
