/**
 * Claim TTL & Auto-Release
 *
 * Monitors active claims and releases those that exceed the configured TTL.
 * Provides staleness detection and grace-period warnings.
 */

import type { ClaimEntry } from '../../shared/grammar/types.js';
import type { GitAdapter } from '../git/types.js';
import { parseClaims } from '../../shared/parsers/claims-parser.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface ClaimTTLConfig {
  /** TTL in hours before a claim is considered expired. Default: 24. */
  ttlHours: number;
  /** Grace period in hours before TTL expiry to warn. Default: 4. */
  gracePeriodHours: number;
  /** Coordination branch to read/write claims from. */
  coordinationBranch?: string;
}

const DEFAULT_TTL_HOURS = 24;
const DEFAULT_GRACE_PERIOD_HOURS = 4;

export function getClaimTTLConfig(): ClaimTTLConfig {
  const ttlHours = parseInt(process.env['WHEATLEY_CLAIM_TTL_HOURS'] ?? '', 10);
  const gracePeriodHours = parseInt(process.env['WHEATLEY_CLAIM_GRACE_HOURS'] ?? '', 10);

  return {
    ttlHours: Number.isFinite(ttlHours) && ttlHours > 0 ? ttlHours : DEFAULT_TTL_HOURS,
    gracePeriodHours: Number.isFinite(gracePeriodHours) && gracePeriodHours > 0
      ? gracePeriodHours
      : DEFAULT_GRACE_PERIOD_HOURS,
    coordinationBranch: process.env['WHEATLEY_COORDINATION_BRANCH'],
  };
}

// ---------------------------------------------------------------------------
// Staleness analysis
// ---------------------------------------------------------------------------

export type ClaimTTLStatus = 'active' | 'warning' | 'expired';

export interface ClaimWithTTL extends ClaimEntry {
  /** Age of the claim in hours. */
  ageHours: number;
  /** TTL status: active, warning (in grace period), or expired. */
  ttlStatus: ClaimTTLStatus;
  /** Hours remaining until expiry. Negative if already expired. */
  hoursRemaining: number;
}

/**
 * Analyze active claims and compute TTL status for each.
 *
 * @param activeClaims - Map of active claims (from parseClaims)
 * @param config - TTL configuration
 * @param now - Current time (injectable for testing)
 */
export function analyzeClaimTTL(
  activeClaims: Map<string, ClaimEntry>,
  config: ClaimTTLConfig,
  now: Date = new Date(),
): ClaimWithTTL[] {
  const results: ClaimWithTTL[] = [];

  for (const claim of activeClaims.values()) {
    const claimedAt = new Date(claim.claimedAt);
    const ageMs = now.getTime() - claimedAt.getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    const hoursRemaining = config.ttlHours - ageHours;

    let ttlStatus: ClaimTTLStatus = 'active';
    if (hoursRemaining <= 0) {
      ttlStatus = 'expired';
    } else if (hoursRemaining <= config.gracePeriodHours) {
      ttlStatus = 'warning';
    }

    results.push({
      ...claim,
      ageHours: Math.round(ageHours * 10) / 10,
      ttlStatus,
      hoursRemaining: Math.round(hoursRemaining * 10) / 10,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Auto-release
// ---------------------------------------------------------------------------

const CLAIMS_FILE = 'product-knowledge/claims.md';

const CLAIMS_FILE_HEADER = `<!--
GLaDOS-MANAGED DOCUMENT
To modify: Append entries using the format below.
-->

# Claims

`;

/**
 * Auto-release all expired claims by appending [expired] entries to claims.md.
 * Returns the list of expired claims that were released.
 */
export async function autoReleaseExpiredClaims(
  adapter: GitAdapter,
  config: ClaimTTLConfig,
  now: Date = new Date(),
): Promise<ClaimEntry[]> {
  const branch = config.coordinationBranch ?? await adapter.getDefaultBranch();
  const content = await adapter.readFile(CLAIMS_FILE, branch);
  const { activeClaims } = parseClaims(content ?? '');

  const analyzed = analyzeClaimTTL(activeClaims, config, now);
  const expired = analyzed.filter((c) => c.ttlStatus === 'expired');

  if (expired.length === 0) return [];

  const releasedAt = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const newLines = expired.map(
    (c) => `- [expired] ${c.itemId} | ${c.claimant} | ${c.claimedAt} | ${releasedAt}`,
  );

  const base = content?.trim() ? content.trimEnd() : CLAIMS_FILE_HEADER.trimEnd();
  const newContent = `${base}\n${newLines.join('\n')}`;

  await adapter.writeFile(
    CLAIMS_FILE,
    newContent,
    `auto-release: ${expired.length} expired claim(s) after ${config.ttlHours}h TTL`,
    branch,
  );

  return expired.map((c) => ({
    itemId: c.itemId,
    claimant: c.claimant,
    claimedAt: c.claimedAt,
    releasedAt,
    status: 'expired' as const,
  }));
}

// ---------------------------------------------------------------------------
// TTL check endpoint data
// ---------------------------------------------------------------------------

export interface ClaimTTLReport {
  config: { ttlHours: number; gracePeriodHours: number };
  claims: ClaimWithTTL[];
  expiredCount: number;
  warningCount: number;
  activeCount: number;
}

/**
 * Generate a full TTL report for all active claims.
 */
export async function getClaimTTLReport(
  adapter: GitAdapter,
  config: ClaimTTLConfig,
  now: Date = new Date(),
): Promise<ClaimTTLReport> {
  const branch = config.coordinationBranch ?? await adapter.getDefaultBranch();
  const content = await adapter.readFile(CLAIMS_FILE, branch);
  const { activeClaims } = parseClaims(content ?? '');

  const claims = analyzeClaimTTL(activeClaims, config, now);

  return {
    config: { ttlHours: config.ttlHours, gracePeriodHours: config.gracePeriodHours },
    claims,
    expiredCount: claims.filter((c) => c.ttlStatus === 'expired').length,
    warningCount: claims.filter((c) => c.ttlStatus === 'warning').length,
    activeCount: claims.filter((c) => c.ttlStatus === 'active').length,
  };
}
