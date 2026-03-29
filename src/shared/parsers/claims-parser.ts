/**
 * claims.md Parser
 *
 * Extracts claim entries and computes active claims.
 * Pure function: string in, ParsedClaims out. Never throws.
 */

import type { ParsedClaims, ClaimEntry, ClaimStatus } from '../grammar/types.js';

/** Normalize CRLF to LF */
function normalize(content: string): string {
  return content.replace(/\r\n/g, '\n').trimEnd();
}

/** Strip the optional GLaDOS HTML comment header */
function stripHeader(content: string): string {
  return content.replace(/^<!--[\s\S]*?-->\s*\n?/, '');
}

const CLAIM_ENTRY_RE =
  /^- \[(claimed|released|expired)\] (\d+\.\d+\.\d+) \| (.+?) \| (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)( \| (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z))?$/;

export function parseClaims(content: string): ParsedClaims {
  const entries: ClaimEntry[] = [];
  const activeClaims = new Map<string, ClaimEntry>();

  if (!content.trim()) {
    return { entries, activeClaims };
  }

  const body = stripHeader(normalize(content));
  const lines = body.split('\n');

  for (const line of lines) {
    const trimmed = line.trimEnd();
    const match = trimmed.match(CLAIM_ENTRY_RE);
    if (!match) continue;

    const entry: ClaimEntry = {
      status: match[1] as ClaimStatus,
      itemId: match[2],
      claimant: match[3],
      claimedAt: match[4],
      releasedAt: match[6] || undefined,
    };

    entries.push(entry);
  }

  // Compute active claims — last entry per item ID wins
  for (const entry of entries) {
    if (entry.status === 'claimed') {
      activeClaims.set(entry.itemId, entry);
    } else {
      // released or expired overrides a previous claim
      activeClaims.delete(entry.itemId);
    }
  }

  return { entries, activeClaims };
}
