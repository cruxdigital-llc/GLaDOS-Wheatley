import { describe, it, expect, vi } from 'vitest';
import {
  analyzeClaimTTL,
  autoReleaseExpiredClaims,
  getClaimTTLReport,
  type ClaimTTLConfig,
} from '../claim-ttl.js';
import type { ClaimEntry } from '../../../shared/grammar/types.js';
import type { GitAdapter } from '../../git/types.js';

const defaultConfig: ClaimTTLConfig = {
  ttlHours: 24,
  gracePeriodHours: 4,
};

function makeClaim(itemId: string, hoursAgo: number, now: Date): ClaimEntry {
  const claimedAt = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
  return {
    itemId,
    claimant: 'tester',
    claimedAt: claimedAt.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    status: 'claimed',
  };
}

// ---------------------------------------------------------------------------
// analyzeClaimTTL
// ---------------------------------------------------------------------------

describe('analyzeClaimTTL', () => {
  const now = new Date('2026-03-28T12:00:00Z');

  it('marks fresh claims as "active"', () => {
    const claims = new Map([['1.1.1', makeClaim('1.1.1', 2, now)]]);
    const result = analyzeClaimTTL(claims, defaultConfig, now);
    expect(result).toHaveLength(1);
    expect(result[0].ttlStatus).toBe('active');
    expect(result[0].hoursRemaining).toBe(22);
  });

  it('marks claims in grace period as "warning"', () => {
    const claims = new Map([['1.1.1', makeClaim('1.1.1', 21, now)]]);
    const result = analyzeClaimTTL(claims, defaultConfig, now);
    expect(result[0].ttlStatus).toBe('warning');
    expect(result[0].hoursRemaining).toBe(3);
  });

  it('marks expired claims as "expired"', () => {
    const claims = new Map([['1.1.1', makeClaim('1.1.1', 30, now)]]);
    const result = analyzeClaimTTL(claims, defaultConfig, now);
    expect(result[0].ttlStatus).toBe('expired');
    expect(result[0].hoursRemaining).toBe(-6);
  });

  it('handles exact TTL boundary as expired', () => {
    const claims = new Map([['1.1.1', makeClaim('1.1.1', 24, now)]]);
    const result = analyzeClaimTTL(claims, defaultConfig, now);
    expect(result[0].ttlStatus).toBe('expired');
  });

  it('handles multiple claims with different statuses', () => {
    const claims = new Map([
      ['1.1.1', makeClaim('1.1.1', 2, now)],
      ['2.1.1', makeClaim('2.1.1', 22, now)],
      ['3.1.1', makeClaim('3.1.1', 48, now)],
    ]);
    const result = analyzeClaimTTL(claims, defaultConfig, now);
    expect(result.map((c) => c.ttlStatus)).toEqual(
      expect.arrayContaining(['active', 'warning', 'expired']),
    );
  });

  it('respects custom TTL config', () => {
    const shortConfig: ClaimTTLConfig = { ttlHours: 4, gracePeriodHours: 1 };
    const claims = new Map([['1.1.1', makeClaim('1.1.1', 3.5, now)]]);
    const result = analyzeClaimTTL(claims, shortConfig, now);
    expect(result[0].ttlStatus).toBe('warning');
  });

  it('returns empty array for no claims', () => {
    const result = analyzeClaimTTL(new Map(), defaultConfig, now);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// autoReleaseExpiredClaims
// ---------------------------------------------------------------------------

describe('autoReleaseExpiredClaims', () => {
  const now = new Date('2026-03-28T12:00:00Z');
  const oldTimestamp = '2026-03-27T00:00:00Z'; // 36 hours ago

  function createMockAdapter(claimsContent: string | null): GitAdapter {
    return {
      readFile: vi.fn().mockResolvedValue(claimsContent),
      listDirectory: vi.fn().mockResolvedValue([]),
      listBranches: vi.fn().mockResolvedValue(['main']),
      getCurrentBranch: vi.fn().mockResolvedValue('main'),
      getDefaultBranch: vi.fn().mockResolvedValue('main'),
      getLatestSha: vi.fn().mockResolvedValue('abc123'),
      writeFile: vi.fn().mockResolvedValue(undefined),
    };
  }

  it('releases expired claims and writes to claims.md', async () => {
    const content = `# Claims\n\n- [claimed] 1.1.1 | tester | ${oldTimestamp}`;
    const adapter = createMockAdapter(content);

    const released = await autoReleaseExpiredClaims(adapter, defaultConfig, now);
    expect(released).toHaveLength(1);
    expect(released[0].itemId).toBe('1.1.1');
    expect(released[0].status).toBe('expired');
    expect(adapter.writeFile).toHaveBeenCalledWith(
      'product-knowledge/claims.md',
      expect.stringContaining('- [expired] 1.1.1'),
      expect.stringContaining('auto-release: 1 expired claim(s)'),
      'main',
    );
  });

  it('does nothing when no claims are expired', async () => {
    const recentTimestamp = '2026-03-28T11:00:00Z'; // 1 hour ago
    const content = `# Claims\n\n- [claimed] 1.1.1 | tester | ${recentTimestamp}`;
    const adapter = createMockAdapter(content);

    const released = await autoReleaseExpiredClaims(adapter, defaultConfig, now);
    expect(released).toHaveLength(0);
    expect(adapter.writeFile).not.toHaveBeenCalled();
  });

  it('does nothing when claims.md is empty', async () => {
    const adapter = createMockAdapter(null);
    const released = await autoReleaseExpiredClaims(adapter, defaultConfig, now);
    expect(released).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getClaimTTLReport
// ---------------------------------------------------------------------------

describe('getClaimTTLReport', () => {
  const now = new Date('2026-03-28T12:00:00Z');
  const oldTimestamp = '2026-03-27T00:00:00Z';
  const warningTimestamp = '2026-03-27T15:00:00Z'; // 21 hours ago
  const freshTimestamp = '2026-03-28T10:00:00Z'; // 2 hours ago

  it('generates a complete TTL report', async () => {
    const content = [
      '# Claims',
      '',
      `- [claimed] 1.1.1 | alice | ${freshTimestamp}`,
      `- [claimed] 2.1.1 | bob | ${warningTimestamp}`,
      `- [claimed] 3.1.1 | charlie | ${oldTimestamp}`,
    ].join('\n');

    const adapter: GitAdapter = {
      readFile: vi.fn().mockResolvedValue(content),
      listDirectory: vi.fn().mockResolvedValue([]),
      listBranches: vi.fn().mockResolvedValue(['main']),
      getCurrentBranch: vi.fn().mockResolvedValue('main'),
      getDefaultBranch: vi.fn().mockResolvedValue('main'),
      getLatestSha: vi.fn().mockResolvedValue('abc123'),
      writeFile: vi.fn().mockResolvedValue(undefined),
    };

    const report = await getClaimTTLReport(adapter, defaultConfig, now);
    expect(report.activeCount).toBe(1);
    expect(report.warningCount).toBe(1);
    expect(report.expiredCount).toBe(1);
    expect(report.claims).toHaveLength(3);
    expect(report.config.ttlHours).toBe(24);
  });
});
