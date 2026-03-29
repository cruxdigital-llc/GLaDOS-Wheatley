/**
 * Branch Health Service
 *
 * Computes health indicators for each branch:
 *   - commitsBehind    — how many commits the branch is behind the base branch
 *   - lastCommitDate   — ISO 8601 timestamp of the most recent commit
 *   - uniqueSpecs      — spec directory names that exist on this branch but not on base
 *   - conflictRisk     — true when this branch shares spec directories with another branch
 */

import type { GitAdapter } from '../git/types.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface BranchHealth {
  /** Branch name */
  branch: string;
  /** Number of commits the branch is behind `baseBranch`. */
  commitsBehind: number;
  /** ISO 8601 date of the most recent commit on the branch. Null if unavailable. */
  lastCommitDate: string | null;
  /**
   * Spec directory names that exist on this branch but NOT on the base branch.
   * An empty array means no unique specs (or the branch is the base branch).
   */
  uniqueSpecs: string[];
  /**
   * True when another scanned branch also touches one or more of the same spec
   * directories, indicating a potential merge conflict.
   */
  conflictRisk: boolean;
}

// ---------------------------------------------------------------------------
// BranchHealthService
// ---------------------------------------------------------------------------

export class BranchHealthService {
  private readonly adapter: GitAdapter;

  constructor(adapter: GitAdapter) {
    this.adapter = adapter;
  }

  /**
   * Compute health for all provided branches relative to `baseBranch`.
   * When `branches` is omitted, all branches returned by the adapter are used.
   */
  async computeHealth(branches?: string[], baseBranch?: string): Promise<BranchHealth[]> {
    const resolvedBase = baseBranch ?? (await this.adapter.getDefaultBranch());
    const allBranches = branches ?? (await this.adapter.listBranches());

    // Fetch base branch spec dirs once
    const baseSpecDirs = await this.getSpecDirNames(resolvedBase);

    // Compute raw health data for each branch in parallel
    const rawResults = await Promise.all(
      allBranches.map((branch) => this.computeSingleBranch(branch, resolvedBase, baseSpecDirs)),
    );

    // Second pass: compute conflictRisk by looking for overlapping spec dirs
    const results = this.applyConflictRisk(rawResults);

    return results;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Compute health for a single branch (without conflict risk — requires cross-branch data). */
  private async computeSingleBranch(
    branch: string,
    baseBranch: string,
    baseSpecDirs: Set<string>,
  ): Promise<BranchHealth> {
    const [commitsBehind, lastCommitDate, branchSpecDirs] = await Promise.all([
      this.adapter.getCommitsBehind(branch, baseBranch),
      this.adapter.getLastCommitDate(branch),
      this.getSpecDirNames(branch),
    ]);

    const uniqueSpecs = Array.from(branchSpecDirs).filter((d) => !baseSpecDirs.has(d));

    return {
      branch,
      commitsBehind,
      lastCommitDate,
      uniqueSpecs,
      conflictRisk: false, // filled in by applyConflictRisk
    };
  }

  /** List spec directory names for a given branch. */
  private async getSpecDirNames(branch: string): Promise<Set<string>> {
    const entries = await this.adapter.listDirectory('specs', branch);
    const dirs = entries.filter((e) => e.type === 'directory').map((e) => e.name);
    return new Set(dirs);
  }

  /**
   * Set conflictRisk=true on any branch that shares at least one uniqueSpec
   * directory with another branch in the same scan.
   */
  private applyConflictRisk(results: BranchHealth[]): BranchHealth[] {
    // Build a map from spec dir → branches that have it as a unique spec
    const specBranchMap = new Map<string, string[]>();
    for (const result of results) {
      for (const spec of result.uniqueSpecs) {
        if (!specBranchMap.has(spec)) specBranchMap.set(spec, []);
        specBranchMap.get(spec)!.push(result.branch);
      }
    }

    // Any spec dir shared by >1 branch constitutes a conflict risk
    const conflictingBranches = new Set<string>();
    for (const branches of specBranchMap.values()) {
      if (branches.length > 1) {
        for (const b of branches) conflictingBranches.add(b);
      }
    }

    return results.map((r) =>
      conflictingBranches.has(r.branch) ? { ...r, conflictRisk: true } : r,
    );
  }
}
