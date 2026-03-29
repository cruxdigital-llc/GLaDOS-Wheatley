/**
 * Conflict Early Warning
 *
 * Cross-branch file overlap detection. Identifies when two or more branches
 * are editing the same spec directories and suggests resolution order.
 */

import type { GitAdapter } from '../git/types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FileOverlap {
  /** Spec directory name shared by multiple branches. */
  specDir: string;
  /** Branches that have this spec directory. */
  branches: string[];
}

export interface ConflictWarning {
  /** The branches involved in this potential conflict. */
  branches: string[];
  /** Which spec directories overlap. */
  overlappingSpecs: string[];
  /** Recommended merge order: branch that should merge first. */
  suggestedMergeFirst: string;
  /** Reason for the suggestion. */
  reason: string;
}

export interface ConflictReport {
  /** All detected file overlaps. */
  overlaps: FileOverlap[];
  /** High-level conflict warnings with resolution suggestions. */
  warnings: ConflictWarning[];
  /** Number of branches scanned. */
  branchesScanned: number;
}

// ---------------------------------------------------------------------------
// ConflictDetector
// ---------------------------------------------------------------------------

/** Process items in batches of `limit` at a time. */
async function batchedMap<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

export class ConflictDetector {
  constructor(private readonly adapter: GitAdapter) {}

  /**
   * Scan branches for cross-branch spec directory overlaps.
   * Only compares branches against the base branch's spec dirs.
   */
  async detect(
    branches?: string[],
    baseBranch?: string,
  ): Promise<ConflictReport> {
    const resolvedBase = baseBranch ?? await this.adapter.getDefaultBranch();
    const allBranches = branches ?? await this.adapter.listBranches();

    // Exclude base branch from comparison
    const featureBranches = allBranches.filter((b) => b !== resolvedBase);

    // Gather spec dirs per branch (batched, max 5 concurrent)
    const branchSpecs = new Map<string, Set<string>>();
    await batchedMap(featureBranches, 5, async (branch) => {
      const entries = await this.adapter.listDirectory('specs', branch);
      const dirs = entries.filter((e) => e.type === 'directory').map((e) => e.name);
      branchSpecs.set(branch, new Set(dirs));
    });

    // Find overlaps: spec dirs that appear on 2+ feature branches
    const specToBranches = new Map<string, string[]>();
    for (const [branch, specs] of branchSpecs) {
      for (const spec of specs) {
        if (!specToBranches.has(spec)) specToBranches.set(spec, []);
        specToBranches.get(spec)!.push(branch);
      }
    }

    const overlaps: FileOverlap[] = [];
    for (const [specDir, branchList] of specToBranches) {
      if (branchList.length > 1) {
        overlaps.push({ specDir, branches: branchList });
      }
    }

    // Generate warnings with resolution suggestions
    const warnings: ConflictWarning[] = [];
    const seenPairs = new Set<string>();

    for (const overlap of overlaps) {
      // Generate pairwise warnings
      for (let i = 0; i < overlap.branches.length; i++) {
        for (let j = i + 1; j < overlap.branches.length; j++) {
          const a = overlap.branches[i];
          const b = overlap.branches[j];
          const pairKey = [a, b].sort().join('|');

          if (seenPairs.has(pairKey)) {
            // Already generated a warning for this pair, add to overlapping specs
            const existing = warnings.find(
              (w) => [...w.branches].sort().join('|') === pairKey,
            );
            if (existing && !existing.overlappingSpecs.includes(overlap.specDir)) {
              existing.overlappingSpecs.push(overlap.specDir);
            }
            continue;
          }
          seenPairs.add(pairKey);

          // Suggest: the branch with fewer unique specs should merge first
          // (less likely to cause downstream conflicts)
          const aSpecs = branchSpecs.get(a)?.size ?? 0;
          const bSpecs = branchSpecs.get(b)?.size ?? 0;

          let suggestedMergeFirst: string;
          let reason: string;

          if (aSpecs <= bSpecs) {
            suggestedMergeFirst = a;
            reason = `${a} has fewer unique specs (${aSpecs} vs ${bSpecs}), reducing conflict surface`;
          } else {
            suggestedMergeFirst = b;
            reason = `${b} has fewer unique specs (${bSpecs} vs ${aSpecs}), reducing conflict surface`;
          }

          warnings.push({
            branches: [a, b],
            overlappingSpecs: [overlap.specDir],
            suggestedMergeFirst,
            reason,
          });
        }
      }
    }

    return {
      overlaps,
      warnings,
      branchesScanned: featureBranches.length,
    };
  }
}
