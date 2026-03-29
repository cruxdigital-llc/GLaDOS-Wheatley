/**
 * Claim Service
 *
 * Business logic for claiming and releasing roadmap items.
 * Reads claims.md from the coordination branch, appends entries, and commits.
 */

import type { GitAdapter } from '../git/types.js';
import { ConflictError } from '../git/types.js';
import type { ClaimEntry } from '../../shared/grammar/types.js';
import { parseClaims } from '../../shared/parsers/claims-parser.js';

// ---------------------------------------------------------------------------
// Domain error types
// ---------------------------------------------------------------------------

export class AlreadyClaimedError extends Error {
  constructor(public readonly claim: ClaimEntry) {
    super(`Item ${claim.itemId} is already claimed by ${claim.claimant}`);
    this.name = 'AlreadyClaimedError';
  }
}

export class NotClaimedError extends Error {
  constructor(itemId: string) {
    super(`No active claim for item ${itemId}`);
    this.name = 'NotClaimedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

// Re-export so routes can import from one place
export { ConflictError };

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const ITEM_ID_RE = /^\d+\.\d+\.\d+$/;

function validateItemId(itemId: string): void {
  if (!ITEM_ID_RE.test(itemId)) {
    throw new Error(`Invalid item ID format: "${itemId}"`);
  }
}

function validateClaimant(claimant: string): void {
  if (!claimant.trim() || claimant.includes('|')) {
    throw new Error('Invalid claimant: must be non-empty and must not contain a pipe character');
  }
  for (let i = 0; i < claimant.length; i++) {
    if (claimant.charCodeAt(i) < 32) {
      throw new Error('Invalid claimant: must not contain newlines or control characters');
    }
  }
}

// ---------------------------------------------------------------------------
// Claims file builder
// ---------------------------------------------------------------------------

const CLAIMS_FILE_HEADER = `<!--
GLaDOS-MANAGED DOCUMENT
To modify: Append entries using the format below.
-->

# Claims

`;

function buildClaimsContent(existingContent: string | null, newLine: string): string {
  const base = existingContent?.trim() ? existingContent.trimEnd() : CLAIMS_FILE_HEADER.trimEnd();
  return `${base}\n${newLine}`;
}

// ---------------------------------------------------------------------------
// ClaimService
// ---------------------------------------------------------------------------

export class ClaimService {
  private readonly adapter: GitAdapter;
  private readonly coordinationBranchOverride: string | undefined;

  constructor(adapter: GitAdapter, coordinationBranch?: string) {
    this.adapter = adapter;
    this.coordinationBranchOverride = coordinationBranch;
  }

  /** Resolve the coordination branch: constructor arg → env var → adapter default. */
  async getCoordinationBranch(): Promise<string> {
    return (
      this.coordinationBranchOverride ??
      process.env.WHEATLEY_COORDINATION_BRANCH ??
      (await this.adapter.getDefaultBranch())
    );
  }

  /**
   * Claim a roadmap item.
   * Appends a [claimed] entry to claims.md on the coordination branch.
   */
  async claimItem(itemId: string, claimant: string): Promise<ClaimEntry> {
    validateItemId(itemId);
    validateClaimant(claimant);

    const branch = await this.getCoordinationBranch();
    const existingContent = await this.adapter.readFile('product-knowledge/claims.md', branch);
    const { activeClaims } = parseClaims(existingContent ?? '');

    if (activeClaims.has(itemId)) {
      throw new AlreadyClaimedError(activeClaims.get(itemId)!);
    }

    const claimedAt = utcNow();
    const entryLine = `- [claimed] ${itemId} | ${claimant} | ${claimedAt}`;
    const newContent = buildClaimsContent(existingContent, entryLine);

    try {
      await this.adapter.writeFile(
        'product-knowledge/claims.md',
        newContent,
        `claim: ${itemId} by ${claimant}`,
        branch,
      );
    } catch (err) {
      if (err instanceof ConflictError) {
        // Re-read the file to check whether a concurrent writer claimed this item
        const freshContent = await this.adapter.readFile('product-knowledge/claims.md', branch);
        const { activeClaims: freshClaims } = parseClaims(freshContent ?? '');
        if (freshClaims.has(itemId)) {
          throw new AlreadyClaimedError(freshClaims.get(itemId)!);
        }
      }
      throw err;
    }

    return { itemId, claimant, claimedAt, status: 'claimed' };
  }

  /**
   * Release an active claim on a roadmap item.
   * Appends a [released] entry to claims.md on the coordination branch.
   *
   * @param claimant - If provided, only release if the active claim belongs to this claimant.
   */
  async releaseItem(itemId: string, claimant?: string): Promise<ClaimEntry> {
    const branch = await this.getCoordinationBranch();
    const existingContent = await this.adapter.readFile('product-knowledge/claims.md', branch);
    const { activeClaims } = parseClaims(existingContent ?? '');

    const activeClaim = activeClaims.get(itemId);
    if (!activeClaim) {
      throw new NotClaimedError(itemId);
    }

    if (claimant !== undefined && activeClaim.claimant !== claimant) {
      throw new ForbiddenError(
        `Item ${itemId} is claimed by ${activeClaim.claimant}, not ${claimant}`,
      );
    }

    const releasedAt = utcNow();
    const entryLine = `- [released] ${itemId} | ${activeClaim.claimant} | ${activeClaim.claimedAt} | ${releasedAt}`;
    const newContent = buildClaimsContent(existingContent, entryLine);

    await this.adapter.writeFile(
      'product-knowledge/claims.md',
      newContent,
      `release: ${itemId} by ${activeClaim.claimant}`,
      branch,
    );

    return {
      itemId,
      claimant: activeClaim.claimant,
      claimedAt: activeClaim.claimedAt,
      releasedAt,
      status: 'released',
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return the current time as a UTC ISO 8601 string with second precision. */
function utcNow(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}
