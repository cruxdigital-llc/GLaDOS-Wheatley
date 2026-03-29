/**
 * Board State Assembler
 *
 * Merges parser outputs into a unified BoardState for the API.
 * Cross-references roadmap items, spec entries, claims, and status tasks.
 */

import type {
  ParsedRoadmap,
  SpecEntry,
  ParsedProjectStatus,
  ParsedClaims,
  BoardState,
  BoardColumn,
  BoardCard,
  BoardPhase,
  RoadmapItem,
} from '../grammar/types.js';
import { PHASE_ORDER } from '../grammar/types.js';

const COLUMN_TITLES: Record<BoardPhase, string> = {
  unclaimed: 'Unclaimed',
  planning: 'Planning',
  speccing: 'Speccing',
  implementing: 'Implementing',
  verifying: 'Verifying',
  done: 'Done',
};

/**
 * Attempt to match a spec entry to a roadmap item by name.
 * Matching is based on the spec's kebab-case name containing keywords
 * from the roadmap item's section title.
 */
function matchSpecToRoadmapItem(
  spec: SpecEntry,
  allItems: RoadmapItem[],
): RoadmapItem | undefined {
  const specName = spec.name.toLowerCase();

  // Try exact section title match first (kebab-cased)
  for (const item of allItems) {
    const sectionKebab = item.sectionTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    if (specName === sectionKebab || specName.includes(sectionKebab)) {
      return item;
    }
  }

  return undefined;
}

export function assembleBoardState(
  roadmap: ParsedRoadmap,
  specs: SpecEntry[],
  status: ParsedProjectStatus,
  claims: ParsedClaims,
): BoardState {
  const cardMap = new Map<string, BoardCard>();

  // 1. Create cards from roadmap items
  for (const item of roadmap.allItems) {
    const phase: BoardPhase = item.completed ? 'done' : 'unclaimed';
    cardMap.set(item.id, {
      id: item.id,
      title: item.title,
      phase,
      source: 'roadmap',
      roadmapItem: item,
    });
  }

  // 2. Overlay spec entries — they provide more accurate phase info
  for (const spec of specs) {
    if (spec.prefix !== 'feature' && spec.prefix !== 'fix') {
      // Skip non-feature specs (mission-statement, plan-product)
      continue;
    }

    const matchedItem = matchSpecToRoadmapItem(spec, roadmap.allItems);

    if (matchedItem) {
      // Update existing card with spec info and better phase
      const card = cardMap.get(matchedItem.id);
      if (card) {
        card.specEntry = spec;
        // Spec phase is more accurate than roadmap checkbox
        card.phase = spec.phase;
      }
    } else {
      // No matching roadmap item — create a card from the spec
      cardMap.set(spec.dirName, {
        id: spec.dirName,
        title: spec.name.replace(/-/g, ' '),
        phase: spec.phase,
        source: 'spec',
        specEntry: spec,
      });
    }
  }

  // 3. Attach claims
  for (const [itemId, claim] of claims.activeClaims) {
    const card = cardMap.get(itemId);
    if (card) {
      card.claim = claim;
    }
  }

  // 4. Cross-reference status tasks
  for (const task of status.activeTasks) {
    // Try to match status tasks to existing cards by label
    for (const card of cardMap.values()) {
      const cardTitle = card.title.toLowerCase();
      const taskLabel = task.label.toLowerCase();
      if (cardTitle.includes(taskLabel) || taskLabel.includes(cardTitle)) {
        card.statusTask = task;
        break;
      }
    }
  }

  // 5. Organize into columns
  const columns: BoardColumn[] = PHASE_ORDER.map((phase) => ({
    phase,
    title: COLUMN_TITLES[phase],
    cards: [] as BoardCard[],
  }));

  for (const card of cardMap.values()) {
    const column = columns.find((c) => c.phase === card.phase);
    if (column) {
      column.cards.push(card);
    }
  }

  // 6. Compute metadata
  const allCards = Array.from(cardMap.values());
  const metadata = {
    totalCards: allCards.length,
    claimedCount: allCards.filter((c) => c.claim).length,
    completedCount: allCards.filter((c) => c.phase === 'done').length,
  };

  return { columns, metadata };
}
