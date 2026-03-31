/**
 * PR Link Service
 *
 * Links board cards to pull requests / merge requests by deriving
 * candidate branch names from a card ID and querying the platform adapter.
 */

import type { PlatformAdapter, PullRequest } from '../platforms/types.js';

/**
 * Given a card ID (e.g. "1.2.3"), derive the set of branch-name patterns
 * an engineer is likely to have used.
 */
function deriveBranchCandidates(cardId: string): string[] {
  // Card IDs look like "1.2.3"; spec dirs are typically "1-2-3_slug"
  const dashed = cardId.replace(/\./g, '-');

  return [
    // Common conventions
    `feat/${dashed}`,
    `feature/${dashed}`,
    `fix/${dashed}`,
    `bugfix/${dashed}`,
    // Dotted variants
    `feat/${cardId}`,
    `feature/${cardId}`,
    `fix/${cardId}`,
    // Plain ID as prefix
    dashed,
    cardId,
  ];
}

export class PRLinkService {
  private readonly adapter: PlatformAdapter;

  constructor(adapter: PlatformAdapter) {
    this.adapter = adapter;
  }

  /**
   * Find PRs linked to a given card ID.
   *
   * Queries the platform for PRs whose source branch matches any of the
   * candidate branch names derived from the card ID.
   */
  async findPRsForCard(cardId: string): Promise<PullRequest[]> {
    if (this.adapter.platform === 'none') return [];

    const candidates = deriveBranchCandidates(cardId);
    const seen = new Set<number>();
    const results: PullRequest[] = [];

    // Query each candidate branch; many will return empty
    for (const branch of candidates) {
      const prs = await this.adapter.listPRs(branch);
      for (const pr of prs) {
        if (!seen.has(pr.id)) {
          seen.add(pr.id);
          results.push(pr);
        }
      }
    }

    return results;
  }
}
