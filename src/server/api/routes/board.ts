/**
 * Board Routes
 *
 * GET /api/board — full board state (optional ?branch= query param)
 * GET /api/board/card/:id — card detail with spec contents
 * GET /api/board/consolidated — merged board across all (or filtered) branches
 *
 * Claims are always read from the coordination branch (resolved via ClaimService),
 * while roadmap, specs, and status are read from the requested view branch.
 */

import type { FastifyInstance } from 'fastify';
import type { BoardService } from '../board-service.js';
import type { ClaimService } from '../claim-service.js';
import type { BoardCache } from '../board-cache.js';
import { BranchScanner, type BranchScanConfig } from '../branch-scanner.js';
import { mergeBoards } from '../../../shared/consolidation/merge.js';
import type { GitAdapter } from '../../git/types.js';

export function boardRoutes(
  app: FastifyInstance,
  boardService: BoardService,
  claimService: ClaimService,
  adapter?: GitAdapter,
  scanner?: BranchScanner,
  cache?: BoardCache,
): void {
  app.get<{ Querystring: { branch?: string } }>('/api/board', async (request, reply) => {
    const branch = request.query.branch || undefined;

    // ETag / cache support
    if (cache && adapter) {
      const sha = await adapter.getLatestSha(branch) ?? 'unknown';
      const cacheKey = `board:${branch ?? 'default'}`;
      const cached = cache.get(cacheKey, sha);

      if (cached) {
        const ifNoneMatch = request.headers['if-none-match'];
        if (ifNoneMatch === cached.etag) {
          return reply.status(304).send();
        }
        void reply.header('ETag', cached.etag);
        return cached.data;
      }

      const coordinationBranch = await claimService.getCoordinationBranch();
      const data = await boardService.getBoardState(branch, coordinationBranch);
      const etag = cache.set(cacheKey, data, sha);
      void reply.header('ETag', etag);
      return data;
    }

    const coordinationBranch = await claimService.getCoordinationBranch();
    return boardService.getBoardState(branch, coordinationBranch);
  });

  app.get<{
    Params: { id: string };
    Querystring: { branch?: string };
  }>('/api/board/card/:id', async (request, reply) => {
    const { id } = request.params;

    // Validate card ID format
    if (!/^\d+\.\d+\.\d+$/.test(id) && !/^\d{4}-\d{2}-\d{2}_/.test(id)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `Invalid card ID format: "${id}"`,
      });
    }

    const branch = request.query.branch || undefined;
    const coordinationBranch = await claimService.getCoordinationBranch();
    const result = await boardService.getCardDetail(id, branch, coordinationBranch);

    if (!result) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Card "${id}" not found`,
      });
    }

    return result;
  });

  // ---------------------------------------------------------------------------
  // GET /api/board/consolidated
  // ---------------------------------------------------------------------------

  app.get<{
    Querystring: {
      include?: string;
      exclude?: string;
      prefixes?: string;
    };
  }>('/api/board/consolidated', async (request, reply) => {
    if (!adapter) {
      // Return an empty consolidated state when no adapter is injected
      return {
        columns: [],
        metadata: { totalCards: 0, claimedCount: 0, completedCount: 0, branchCount: 0 },
        branches: [],
      };
    }

    const { include, exclude, prefixes } = request.query;

    const MAX_PATTERN_LENGTH = 200;

    const config: BranchScanConfig = {};
    try {
      if (include) {
        const parts = include.split(',').map((p) => p.trim()).filter(Boolean);
        for (const p of parts) {
          if (p.length > MAX_PATTERN_LENGTH) {
            return reply.status(400).send({
              statusCode: 400,
              error: 'Bad Request',
              message: `Regex pattern too long (max ${MAX_PATTERN_LENGTH} chars)`,
            });
          }
        }
        config.include = parts.map((p) => new RegExp(p));
      }
      if (exclude) {
        const parts = exclude.split(',').map((p) => p.trim()).filter(Boolean);
        for (const p of parts) {
          if (p.length > MAX_PATTERN_LENGTH) {
            return reply.status(400).send({
              statusCode: 400,
              error: 'Bad Request',
              message: `Regex pattern too long (max ${MAX_PATTERN_LENGTH} chars)`,
            });
          }
        }
        config.exclude = parts.map((p) => new RegExp(p));
      }
    } catch {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid regex pattern in query parameter',
      });
    }
    if (prefixes) config.prefixes = prefixes.split(',').map((p) => p.trim());

    const resolvedScanner = scanner ?? new BranchScanner(adapter);
    const results = await resolvedScanner.scanAllBranches(config);
    return mergeBoards(results);
  });
}
