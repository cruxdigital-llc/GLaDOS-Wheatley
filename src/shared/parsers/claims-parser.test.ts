import { describe, it, expect } from 'vitest';
import { parseClaims } from './claims-parser.js';

describe('parseClaims', () => {
  it('returns empty for empty content', () => {
    const result = parseClaims('');
    expect(result.entries).toHaveLength(0);
    expect(result.activeClaims.size).toBe(0);
  });

  it('parses claim entries', () => {
    const content = `# Claims

- [claimed] 1.1.1 | jed2nd | 2026-03-28T20:00:00Z
- [released] 1.1.2 | agent-1 | 2026-03-28T18:00:00Z | 2026-03-28T20:00:00Z
`;
    const result = parseClaims(content);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].status).toBe('claimed');
    expect(result.entries[0].itemId).toBe('1.1.1');
    expect(result.entries[0].claimant).toBe('jed2nd');
    expect(result.entries[0].claimedAt).toBe('2026-03-28T20:00:00Z');
  });

  it('computes active claims (last entry wins)', () => {
    const content = `# Claims

- [claimed] 1.1.1 | jed2nd | 2026-03-28T18:00:00Z
- [released] 1.1.1 | jed2nd | 2026-03-28T18:00:00Z | 2026-03-28T20:00:00Z
- [claimed] 1.2.1 | agent-1 | 2026-03-28T19:00:00Z
`;
    const result = parseClaims(content);
    expect(result.entries).toHaveLength(3);
    // 1.1.1 was claimed then released — not active
    expect(result.activeClaims.has('1.1.1')).toBe(false);
    // 1.2.1 is claimed — active
    expect(result.activeClaims.has('1.2.1')).toBe(true);
    expect(result.activeClaims.get('1.2.1')?.claimant).toBe('agent-1');
  });

  it('handles expired claims', () => {
    const content = `# Claims

- [claimed] 1.1.1 | agent-1 | 2026-03-27T10:00:00Z
- [expired] 1.1.1 | agent-1 | 2026-03-27T10:00:00Z | 2026-03-28T10:00:00Z
`;
    const result = parseClaims(content);
    expect(result.activeClaims.has('1.1.1')).toBe(false);
  });

  it('re-claim after release creates new active claim', () => {
    const content = `# Claims

- [claimed] 1.1.1 | jed2nd | 2026-03-28T18:00:00Z
- [released] 1.1.1 | jed2nd | 2026-03-28T18:00:00Z | 2026-03-28T19:00:00Z
- [claimed] 1.1.1 | agent-2 | 2026-03-28T20:00:00Z
`;
    const result = parseClaims(content);
    expect(result.activeClaims.has('1.1.1')).toBe(true);
    expect(result.activeClaims.get('1.1.1')?.claimant).toBe('agent-2');
  });

  it('skips malformed lines', () => {
    const content = `# Claims

- [claimed] 1.1.1 | jed2nd | 2026-03-28T20:00:00Z
This is not a claim line
- bad format here
`;
    const result = parseClaims(content);
    expect(result.entries).toHaveLength(1);
  });

  it('handles CRLF', () => {
    const content = `# Claims\r\n\r\n- [claimed] 1.1.1 | jed2nd | 2026-03-28T20:00:00Z\r\n`;
    const result = parseClaims(content);
    expect(result.entries).toHaveLength(1);
  });
});
