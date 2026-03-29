import type { CardRelationship, CardRelationships, RelationshipType } from './types.js';

function getOrCreate(map: Map<string, CardRelationships>, cardId: string): CardRelationships {
  let entry = map.get(cardId);
  if (!entry) {
    entry = { cardId, children: [], blocks: [], blockedBy: [] };
    map.set(cardId, entry);
  }
  return entry;
}

/** Build relationships map from a list of relationship edges. */
export function resolveRelationships(edges: CardRelationship[]): Map<string, CardRelationships> {
  const map = new Map<string, CardRelationships>();

  for (const edge of edges) {
    const source = getOrCreate(map, edge.sourceId);
    // Ensure target entry exists too
    getOrCreate(map, edge.targetId);

    switch (edge.type) {
      case 'parent':
        source.parent = edge.targetId;
        getOrCreate(map, edge.targetId).children.push(edge.sourceId);
        break;
      case 'child':
        source.children.push(edge.targetId);
        getOrCreate(map, edge.targetId).parent = edge.sourceId;
        break;
      case 'blocks':
        source.blocks.push(edge.targetId);
        getOrCreate(map, edge.targetId).blockedBy.push(edge.sourceId);
        break;
      case 'blocked-by':
        source.blockedBy.push(edge.targetId);
        getOrCreate(map, edge.targetId).blocks.push(edge.sourceId);
        break;
    }
  }

  return map;
}

/** Detect cycles in the "blocks" dependency graph. Returns array of card IDs in the cycle, or empty if none. */
export function detectCycles(relationships: Map<string, CardRelationships>): string[] {
  const WHITE = 0; // unvisited
  const GRAY = 1;  // in current DFS path
  const BLACK = 2; // fully processed

  const color = new Map<string, number>();
  const parentMap = new Map<string, string>();

  for (const id of relationships.keys()) {
    color.set(id, WHITE);
  }

  for (const id of relationships.keys()) {
    if (color.get(id) === WHITE) {
      const cycle = dfs(id, relationships, color, parentMap);
      if (cycle.length > 0) {
        return cycle;
      }
    }
  }

  return [];
}

function dfs(
  node: string,
  relationships: Map<string, CardRelationships>,
  color: Map<string, number>,
  parentMap: Map<string, string>,
): string[] {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;

  color.set(node, GRAY);

  const rel = relationships.get(node);
  if (rel) {
    for (const neighbor of rel.blocks) {
      if (color.get(neighbor) === GRAY) {
        // Found a cycle — reconstruct it
        const cycle: string[] = [neighbor];
        let current: string | undefined = node;
        while (current && current !== neighbor) {
          cycle.push(current);
          current = parentMap.get(current);
        }
        cycle.push(neighbor);
        return cycle.reverse();
      }
      if (color.get(neighbor) === WHITE) {
        parentMap.set(neighbor, node);
        const cycle = dfs(neighbor, relationships, color, parentMap);
        if (cycle.length > 0) {
          return cycle;
        }
      }
    }
  }

  color.set(node, BLACK);
  return [];
}

/** Extract relationship edges from card metadata frontmatter fields. */
export function extractRelationshipsFromMetadata(
  cardId: string,
  metadata: { parent?: string; children?: string[]; blocks?: string[]; blockedBy?: string[] } | undefined,
): CardRelationship[] {
  if (!metadata) {
    return [];
  }

  const edges: CardRelationship[] = [];

  if (metadata.parent) {
    edges.push({ sourceId: cardId, targetId: metadata.parent, type: 'parent' });
  }

  if (metadata.children) {
    for (const child of metadata.children) {
      edges.push({ sourceId: cardId, targetId: child, type: 'child' });
    }
  }

  if (metadata.blocks) {
    for (const blocked of metadata.blocks) {
      edges.push({ sourceId: cardId, targetId: blocked, type: 'blocks' });
    }
  }

  if (metadata.blockedBy) {
    for (const blocker of metadata.blockedBy) {
      edges.push({ sourceId: cardId, targetId: blocker, type: 'blocked-by' });
    }
  }

  return edges;
}

/** Build all relationships from a flat list of cards with metadata. */
export function buildRelationshipsFromCards(
  cards: Array<{ id: string; metadata?: { parent?: string; children?: string[]; blocks?: string[]; blockedBy?: string[] } }>,
): Map<string, CardRelationships> {
  const allEdges: CardRelationship[] = [];

  for (const card of cards) {
    const edges = extractRelationshipsFromMetadata(card.id, card.metadata);
    allEdges.push(...edges);
  }

  return resolveRelationships(allEdges);
}
