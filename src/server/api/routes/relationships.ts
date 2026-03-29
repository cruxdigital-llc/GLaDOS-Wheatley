/**
 * Card Relationship Routes
 *
 * GET  /api/cards/:id/relationships — get relationships for a card
 * PUT  /api/cards/:id/relationships — update relationships for a card
 * GET  /api/relationships/cycles    — detect dependency cycles
 */

import type { FastifyInstance } from 'fastify';
import type { GitAdapter } from '../../git/types.js';
import { parseFrontmatter, updateFrontmatter } from '../../../shared/parsers/frontmatter-parser.js';
import {
  extractRelationshipsFromMetadata,
  resolveRelationships,
  detectCycles,
} from '../../../shared/relationships/resolver.js';
import type { CardRelationship } from '../../../shared/relationships/types.js';
import { BoardService } from '../board-service.js';

const SAFE_ID_RE = /^\d+\.\d+\.\d+$/;
const SAFE_DIR_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;
const MAX_RELATIONS = 20;

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

export function relationshipRoutes(
  app: FastifyInstance,
  adapter: GitAdapter,
  boardService: BoardService,
): void {
  // GET /api/cards/:id/relationships
  app.get<{
    Params: { id: string };
    Querystring: { branch?: string };
  }>('/api/cards/:id/relationships', async (request, reply) => {
    const { id } = request.params;
    if (!SAFE_ID_RE.test(id)) {
      return reply.status(400).send({ error: 'Invalid card ID format' });
    }

    const branch = request.query.branch;
    const specDir = await findSpecDir(adapter, id, branch);
    if (!specDir || !SAFE_DIR_RE.test(specDir)) {
      return reply.status(200).send({
        cardId: id,
        parent: null,
        children: [],
        blocks: [],
        blockedBy: [],
      });
    }

    const readmePath = `specs/${specDir}/README.md`;
    const content = await adapter.readFile(readmePath, branch);
    if (!content) {
      return reply.status(200).send({
        cardId: id,
        parent: null,
        children: [],
        blocks: [],
        blockedBy: [],
      });
    }

    const fm = parseFrontmatter(content);
    const edges = extractRelationshipsFromMetadata(id, fm as unknown as Record<string, unknown>);
    const resolved = resolveRelationships(edges);
    const rels = resolved.get(id) ?? {
      cardId: id,
      parent: undefined,
      children: [],
      blocks: [],
      blockedBy: [],
    };

    return reply.status(200).send(rels);
  });

  // PUT /api/cards/:id/relationships
  app.put<{
    Params: { id: string };
    Body: {
      parent?: unknown;
      children?: unknown;
      blocks?: unknown;
      blockedBy?: unknown;
      branch?: unknown;
    };
  }>('/api/cards/:id/relationships', async (request, reply) => {
    const { id } = request.params;
    if (!SAFE_ID_RE.test(id)) {
      return reply.status(400).send({ error: 'Invalid card ID format' });
    }

    const { parent, children, blocks, blockedBy, branch } = request.body ?? {};
    const branchStr = typeof branch === 'string' ? branch : undefined;

    // Validate relationship targets
    const validateIdArray = (arr: unknown, field: string): string[] | null => {
      if (arr === undefined) return null;
      if (!Array.isArray(arr) || arr.length > MAX_RELATIONS) {
        return null;
      }
      for (const item of arr) {
        if (typeof item !== 'string' || !SAFE_ID_RE.test(item)) {
          return null;
        }
      }
      return arr as string[];
    };

    const childrenArr = children !== undefined ? validateIdArray(children, 'children') : undefined;
    const blocksArr = blocks !== undefined ? validateIdArray(blocks, 'blocks') : undefined;
    const blockedByArr = blockedBy !== undefined ? validateIdArray(blockedBy, 'blockedBy') : undefined;

    if (parent !== undefined && parent !== null && (typeof parent !== 'string' || !SAFE_ID_RE.test(parent))) {
      return reply.status(400).send({ error: 'parent must be a valid card ID' });
    }

    const specDir = await findSpecDir(adapter, id, branchStr);
    if (!specDir || !SAFE_DIR_RE.test(specDir)) {
      return reply.status(404).send({ error: 'No spec directory found' });
    }

    const readmePath = `specs/${specDir}/README.md`;
    const content = await adapter.readFile(readmePath, branchStr);
    if (!content) {
      return reply.status(404).send({ error: 'README.md not found' });
    }

    const update: Record<string, unknown> = {};
    if (parent !== undefined) update.parent = parent ?? null;
    if (childrenArr !== undefined) update.children = childrenArr;
    if (blocksArr !== undefined) update.blocks = blocksArr;
    if (blockedByArr !== undefined) update.blockedBy = blockedByArr;

    const updated = updateFrontmatter(content, update as Record<string, string[] | string | null>);

    await adapter.writeFile(
      readmePath,
      updated,
      `wheatley: update relationships for ${id}`,
      branchStr,
    );

    return reply.status(200).send({ updated: true });
  });

  // GET /api/relationships/cycles — detect cycles in the dependency graph
  app.get<{
    Querystring: { branch?: string };
  }>('/api/relationships/cycles', async (request, reply) => {
    const branch = request.query.branch;
    const board = await boardService.getBoardState(branch);

    const allEdges: CardRelationship[] = [];
    for (const col of board.columns) {
      for (const card of col.cards) {
        if (card.specEntry) {
          const readmePath = `specs/${card.specEntry.dirName}/README.md`;
          const content = await adapter.readFile(readmePath, branch);
          if (content) {
            const fm = parseFrontmatter(content);
            const edges = extractRelationshipsFromMetadata(card.id, fm as unknown as Record<string, unknown>);
            allEdges.push(...edges);
          }
        }
      }
    }

    const resolved = resolveRelationships(allEdges);
    const cycleIds = detectCycles(resolved);

    return reply.status(200).send({
      hasCycles: cycleIds.length > 0,
      cycleCardIds: cycleIds,
    });
  });
}
