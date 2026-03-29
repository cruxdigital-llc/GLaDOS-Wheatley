/**
 * Branch Scanner
 *
 * Enumerates all matching branches in a repository and parses their board
 * state independently.  A SHA-based cache prevents re-parsing branches
 * that have not changed since the last scan.
 *
 * Configuration is read from environment variables at construction time:
 *   WHEATLEY_SCAN_INCLUDE — comma-separated regex patterns; only matching branches included
 *   WHEATLEY_SCAN_EXCLUDE — comma-separated regex patterns; matching branches excluded
 */

import type { GitAdapter } from '../git/types.js';
import type { BoardState } from '../../shared/grammar/types.js';
import { BoardService } from './board-service.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface BranchScanConfig {
  /** Include branches whose names match ANY of these patterns. */
  include?: RegExp[];
  /** Exclude branches whose names match ANY of these patterns. */
  exclude?: RegExp[];
  /** Convenience shorthand: include branches starting with any of these prefixes. */
  prefixes?: string[];
}

export interface ScanResult {
  branch: string;
  boardState: BoardState;
  sha: string;
}

// ---------------------------------------------------------------------------
// Cache entry
// ---------------------------------------------------------------------------

interface CacheEntry {
  sha: string;
  boardState: BoardState;
}

// ---------------------------------------------------------------------------
// Helper: parse env-var pattern lists
// ---------------------------------------------------------------------------

function parsePatterns(envValue: string | undefined): RegExp[] {
  if (!envValue) return [];
  const results: RegExp[] = [];
  for (const raw of envValue.split(',')) {
    const pattern = raw.trim();
    if (!pattern) continue;
    try {
      results.push(new RegExp(pattern));
    } catch {
      // eslint-disable-next-line no-console
      console.warn(`[BranchScanner] Skipping invalid regex pattern from env: "${pattern}"`);
    }
  }
  return results;
}

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

// ---------------------------------------------------------------------------
// BranchScanner
// ---------------------------------------------------------------------------

export class BranchScanner {
  private readonly adapter: GitAdapter;
  private readonly boardService: BoardService;
  private readonly cache: Map<string, CacheEntry> = new Map();

  /** Default config sourced from environment variables. */
  private readonly envConfig: BranchScanConfig;

  constructor(adapter: GitAdapter) {
    this.adapter = adapter;
    this.boardService = new BoardService(adapter);
    this.envConfig = {
      include: parsePatterns(process.env['WHEATLEY_SCAN_INCLUDE']),
      exclude: parsePatterns(process.env['WHEATLEY_SCAN_EXCLUDE']),
    };
  }

  /**
   * Scan all branches matching the given (or environment-derived) config.
   * Returns one ScanResult per included branch.  Results are cached by SHA so
   * unchanged branches are not re-parsed.
   */
  async scanAllBranches(config?: BranchScanConfig): Promise<ScanResult[]> {
    const mergedConfig = this.mergeConfig(config);
    const allBranches = await this.adapter.listBranches();
    const branches = allBranches.filter((b) => this.matchesBranchConfig(b, mergedConfig));

    const results = await batchedMap(branches, 5, (branch) => this.scanBranch(branch));

    // Filter out null entries (branches whose SHA couldn't be resolved)
    const filtered = results.filter((r): r is ScanResult => r !== null);

    // Prune cache keys for branches no longer present
    const currentBranchSet = new Set(branches);
    for (const key of this.cache.keys()) {
      if (!currentBranchSet.has(key)) {
        this.cache.delete(key);
      }
    }

    return filtered;
  }

  /**
   * Invalidate the entire cache (useful for testing or forced refresh).
   */
  clearCache(): void {
    this.cache.clear();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Scan a single branch, using the SHA cache to skip unchanged branches. */
  private async scanBranch(branch: string): Promise<ScanResult | null> {
    const sha = await this.adapter.getLatestSha(branch);
    if (!sha) return null;

    const cached = this.cache.get(branch);
    if (cached && cached.sha === sha) {
      return { branch, boardState: cached.boardState, sha };
    }

    const boardState = await this.boardService.getBoardState(branch);
    this.cache.set(branch, { sha, boardState });
    return { branch, boardState, sha };
  }

  /** Merge caller-supplied config with the env-derived defaults. */
  private mergeConfig(config?: BranchScanConfig): BranchScanConfig {
    return {
      include: [...(this.envConfig.include ?? []), ...(config?.include ?? [])],
      exclude: [...(this.envConfig.exclude ?? []), ...(config?.exclude ?? [])],
      prefixes: config?.prefixes ?? [],
    };
  }

  /** Return true if `branch` should be included based on the config. */
  private matchesBranchConfig(branch: string, config: BranchScanConfig): boolean {
    // Exclude check (takes priority)
    if (config.exclude?.some((re) => re.test(branch))) return false;

    // If neither include patterns nor prefixes are set, include everything
    const hasInclude = (config.include?.length ?? 0) > 0;
    const hasPrefixes = (config.prefixes?.length ?? 0) > 0;
    if (!hasInclude && !hasPrefixes) return true;

    // Include check: prefix OR pattern match is sufficient
    if (hasPrefixes && config.prefixes!.some((p) => branch.startsWith(p))) return true;
    if (hasInclude && config.include!.some((re) => re.test(branch))) return true;

    return false;
  }
}
