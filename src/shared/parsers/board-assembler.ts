/**
 * Board State Assembler
 *
 * Merges parser outputs into a unified BoardState for the API.
 * Cross-references roadmap items, spec entries, claims, and status tasks.
 */

import type {
  ParsedRoadmap,
  RoadmapSection,
  SpecEntry,
  ParsedProjectStatus,
  ParsedClaims,
  BoardState,
  BoardColumn,
  BoardCard,
  BoardPhase,
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
 * Attempt to match a spec entry to a roadmap section by name.
 * Returns all items in the matched section.
 */
function matchSpecToRoadmapSection(
  spec: SpecEntry,
  roadmap: ParsedRoadmap,
): RoadmapSection | undefined {
  const specName = spec.name.toLowerCase();

  for (const phase of roadmap.phases) {
    for (const section of phase.sections) {
      const sectionKebab = section.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      if (
        specName === sectionKebab ||
        specName.includes(sectionKebab) ||
        sectionKebab.includes(specName)
      ) {
        return section;
      }
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
  //    Specs match to roadmap SECTIONS, so all items in the section get updated
  for (const spec of specs) {
    if (spec.prefix !== 'feature' && spec.prefix !== 'fix') {
      continue;
    }

    const matchedSection = matchSpecToRoadmapSection(spec, roadmap);

    if (matchedSection) {
      // Update ALL cards in the matched section with spec info and better phase
      for (const item of matchedSection.items) {
        const card = cardMap.get(item.id);
        if (card) {
          card.specEntry = spec;
          // Only override phase if the item isn't already individually marked done
          if (!item.completed) {
            card.phase = spec.phase;
          }
        }
      }
    } else {
      // No matching roadmap section — create a card from the spec
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

  // 4. Cross-reference status tasks (exact label match only)
  const statusTaskMap = new Map(
    status.activeTasks.map((t) => [t.label.toLowerCase(), t]),
  );
  for (const card of cardMap.values()) {
    // Match by exact roadmap section title → status task label
    const sectionTitle = card.roadmapItem?.sectionTitle?.toLowerCase();
    if (sectionTitle && statusTaskMap.has(sectionTitle)) {
      card.statusTask = statusTaskMap.get(sectionTitle);
      continue;
    }
    // Fallback: exact match on card title → task label
    const taskLabel = card.title.toLowerCase();
    if (statusTaskMap.has(taskLabel)) {
      card.statusTask = statusTaskMap.get(taskLabel);
    }
  }

  // 5. Organize into columns (using Map for O(1) lookup)
  const columnMap = new Map<BoardPhase, BoardColumn>();
  const columns: BoardColumn[] = PHASE_ORDER.map((phase) => {
    const col: BoardColumn = { phase, title: COLUMN_TITLES[phase], cards: [] };
    columnMap.set(phase, col);
    return col;
  });

  for (const card of cardMap.values()) {
    columnMap.get(card.phase)?.cards.push(card);
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
