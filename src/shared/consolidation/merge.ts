/**
 * Board Consolidation — merge.ts
 *
 * Merges board states from multiple branches into a single ConsolidatedBoardState.
 *
 * Deduplication rules:
 *  - Cards with the same `id` are merged into one entry.
 *  - The merged card carries `branches: string[]` listing every branch it was found on.
 *  - The card's phase is taken from the branch that appears latest in the results array
 *    (i.e., the most-recently-scanned branch wins for metadata like phase/claim).
 *  - Cards unique to a single branch still receive `branches: [branch]` for consistency.
 */

import type { BoardCard, BoardColumn, BoardState } from '../grammar/types.js';

/** Minimal scan result needed for merging — mirrors server/api/branch-scanner.ts ScanResult. */
export interface ScanResultForMerge {
  branch: string;
  boardState: BoardState;
  sha: string;
}

export interface ConsolidatedBoardState {
  /** Columns in standard phase order containing deduplicated, merged cards. */
  columns: BoardColumn[];
  /** Summary metadata across all branches. */
  metadata: {
    totalCards: number;
    claimedCount: number;
    completedCount: number;
    /** Number of branches that were merged. */
    branchCount: number;
  };
  /** The branch names that were included in this consolidated view. */
  branches: string[];
}

/**
 * Merge board states from multiple ScanResults into one ConsolidatedBoardState.
 *
 * Cards are deduplicated by their `id`.  When the same card ID appears on more
 * than one branch, the card is shown once with `branches` populated to indicate
 * all branches it was found on.
 */
export function mergeBoards(results: ScanResultForMerge[]): ConsolidatedBoardState {
  if (results.length === 0) {
    return {
      columns: [],
      metadata: { totalCards: 0, claimedCount: 0, completedCount: 0, branchCount: 0 },
      branches: [],
    };
  }

  // Collect all unique phases in the standard order using the first result's columns
  // (all board states share the same phase layout).
  const phaseOrder = results[0].boardState.columns.map((c) => c.phase);

  // Map from card ID → merged card
  const cardMap = new Map<string, BoardCard>();
  // Map from card ID → set of branches
  const branchesMap = new Map<string, Set<string>>();

  for (const { branch, boardState } of results) {
    for (const column of boardState.columns) {
      for (const card of column.cards) {
        if (!branchesMap.has(card.id)) {
          branchesMap.set(card.id, new Set());
        }
        branchesMap.get(card.id)!.add(branch);

        // Later branches overwrite card metadata (phase, claim, etc.)
        cardMap.set(card.id, card);
      }
    }
  }

  // Attach the branches list to each merged card
  for (const [id, card] of cardMap) {
    const branchSet = branchesMap.get(id)!;
    cardMap.set(id, { ...card, branches: Array.from(branchSet).sort() });
  }

  // Re-distribute cards into phase columns
  const columnMap = new Map<string, BoardCard[]>();
  for (const phase of phaseOrder) {
    columnMap.set(phase, []);
  }

  for (const card of cardMap.values()) {
    const list = columnMap.get(card.phase);
    if (list) {
      list.push(card);
    } else {
      // Fallback: put in unclaimed if phase is unknown
      columnMap.get('unclaimed')?.push(card);
    }
  }

  // Build columns from the first result's column titles
  const columns: BoardColumn[] = results[0].boardState.columns.map((col) => ({
    phase: col.phase,
    title: col.title,
    cards: columnMap.get(col.phase) ?? [],
  }));

  const allCards = Array.from(cardMap.values());
  const totalCards = allCards.length;
  const claimedCount = allCards.filter((c) => c.claim).length;
  const completedCount = allCards.filter((c) => c.phase === 'done').length;

  return {
    columns,
    metadata: {
      totalCards,
      claimedCount,
      completedCount,
      branchCount: results.length,
    },
    branches: results.map((r) => r.branch),
  };
}
