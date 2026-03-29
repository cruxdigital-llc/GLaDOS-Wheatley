import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createServer } from '../server.js';
import type { GitAdapter } from '../../git/types.js';
import { ConflictError } from '../../git/types.js';

// ---------------------------------------------------------------------------
// Mock adapter factory
// ---------------------------------------------------------------------------

type WriteFn = (path: string, content: string, message: string, branch?: string) => Promise<void>;

function createMockAdapter(overrides: Partial<GitAdapter> = {}): GitAdapter {
  return {
    readFile: vi.fn().mockResolvedValue(null),
    listDirectory: vi.fn().mockResolvedValue([]),
    listBranches: vi.fn().mockResolvedValue(['main']),
    getCurrentBranch: vi.fn().mockResolvedValue('main'),
    getDefaultBranch: vi.fn().mockResolvedValue('main'),
    getLatestSha: vi.fn().mockResolvedValue('abc123'),
    writeFile: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/** Build the claims.md content for a given set of raw entry lines. */
function buildClaimsFile(lines: string[]): string {
  const header = `<!--\nGLaDOS-MANAGED DOCUMENT\nTo modify: Append entries using the format below.\n-->\n\n# Claims\n`;
  if (lines.length === 0) return header;
  return `${header}\n${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// POST /api/claims
// ---------------------------------------------------------------------------

describe('POST /api/claims', () => {
  let app: FastifyInstance;
  let mockAdapter: GitAdapter;

  beforeAll(async () => {
    mockAdapter = createMockAdapter();
    app = await createServer({
      adapter: mockAdapter,
      corsOrigin: true,
      logger: false,
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.mocked(mockAdapter.readFile).mockResolvedValue(null);
    vi.mocked(mockAdapter.writeFile).mockResolvedValue(undefined);
  });

  it('returns 201 with ClaimEntry on successful claim', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/claims',
      body: { itemId: '2.2.4', claimant: 'agent-claude' },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.itemId).toBe('2.2.4');
    expect(body.claimant).toBe('agent-claude');
    expect(body.status).toBe('claimed');
    expect(body.claimedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  it('calls writeFile with claims.md and coordination branch', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/claims',
      body: { itemId: '2.2.5', claimant: 'tester' },
    });

    expect(mockAdapter.writeFile).toHaveBeenCalledWith(
      'product-knowledge/claims.md',
      expect.stringContaining('- [claimed] 2.2.5 | tester |'),
      'claim: 2.2.5 by tester',
      'main',
    );
  });

  it('returns 400 for invalid itemId format', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/claims',
      body: { itemId: 'not-valid', claimant: 'agent' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 400 for empty claimant', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/claims',
      body: { itemId: '1.1.1', claimant: '' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 400 for claimant with pipe character', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/claims',
      body: { itemId: '1.1.1', claimant: 'agent|hack' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 400 when body is missing fields', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/claims',
      body: { itemId: '1.1.1' }, // no claimant
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 409 with conflict:true when item is already claimed', async () => {
    const claimedContent = buildClaimsFile([
      '- [claimed] 1.1.1 | existing-agent | 2026-03-28T10:00:00Z',
    ]);
    vi.mocked(mockAdapter.readFile).mockResolvedValue(claimedContent);

    const response = await app.inject({
      method: 'POST',
      url: '/api/claims',
      body: { itemId: '1.1.1', claimant: 'new-agent' },
    });

    expect(response.statusCode).toBe(409);
    const body = response.json();
    expect(body.conflict).toBe(true);
    expect(body.error).toBe('Conflict');
  });

  it('returns 409 with conflict:true on git write conflict', async () => {
    vi.mocked(mockAdapter.writeFile).mockRejectedValue(
      new ConflictError('Push rejected: non-fast-forward conflict on claims.md'),
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/claims',
      body: { itemId: '3.3.3', claimant: 'agent' },
    });

    expect(response.statusCode).toBe(409);
    const body = response.json();
    expect(body.conflict).toBe(true);
  });

  it('returns 500 on unexpected errors', async () => {
    vi.mocked(mockAdapter.writeFile).mockRejectedValue(new Error('Disk full'));

    const response = await app.inject({
      method: 'POST',
      url: '/api/claims',
      body: { itemId: '4.4.4', claimant: 'agent' },
    });

    expect(response.statusCode).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/claims/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/claims/:id', () => {
  let app: FastifyInstance;
  let mockAdapter: GitAdapter;

  const activeClaimsFile = buildClaimsFile([
    '- [claimed] 2.2.5 | agent-claude | 2026-03-28T10:00:00Z',
  ]);

  beforeAll(async () => {
    mockAdapter = createMockAdapter({
      readFile: vi.fn().mockResolvedValue(activeClaimsFile),
    });
    app = await createServer({
      adapter: mockAdapter,
      corsOrigin: true,
      logger: false,
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.mocked(mockAdapter.readFile).mockResolvedValue(activeClaimsFile);
    vi.mocked(mockAdapter.writeFile).mockResolvedValue(undefined);
  });

  it('returns 200 with ClaimEntry on successful release', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/claims/2.2.5',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.itemId).toBe('2.2.5');
    expect(body.status).toBe('released');
    expect(body.claimant).toBe('agent-claude');
    expect(body.releasedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  it('appends a [released] entry with releasedAt timestamp', async () => {
    await app.inject({
      method: 'DELETE',
      url: '/api/claims/2.2.5',
    });

    expect(mockAdapter.writeFile).toHaveBeenCalledWith(
      'product-knowledge/claims.md',
      expect.stringContaining('- [released] 2.2.5 | agent-claude | 2026-03-28T10:00:00Z |'),
      'release: 2.2.5 by agent-claude',
      'main',
    );
  });

  it('returns 404 when there is no active claim for the item', async () => {
    vi.mocked(mockAdapter.readFile).mockResolvedValue(null);

    const response = await app.inject({
      method: 'DELETE',
      url: '/api/claims/9.9.9',
    });

    expect(response.statusCode).toBe(404);
  });

  it('returns 200 when claimant matches the active claim', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/claims/2.2.5?claimant=agent-claude',
    });

    expect(response.statusCode).toBe(200);
  });

  it('returns 403 when claimant does not match the active claim', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/claims/2.2.5?claimant=wrong-agent',
    });

    expect(response.statusCode).toBe(403);
  });

  it('returns 409 with conflict:true on git write conflict', async () => {
    vi.mocked(mockAdapter.writeFile).mockRejectedValue(
      new ConflictError('GitHub API returned 409: conflict on claims.md'),
    );

    const response = await app.inject({
      method: 'DELETE',
      url: '/api/claims/2.2.5',
    });

    expect(response.statusCode).toBe(409);
    const body = response.json();
    expect(body.conflict).toBe(true);
  });

  it('returns 500 on unexpected errors', async () => {
    vi.mocked(mockAdapter.writeFile).mockRejectedValue(new Error('Network error'));

    const response = await app.inject({
      method: 'DELETE',
      url: '/api/claims/2.2.5',
    });

    expect(response.statusCode).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// ClaimService unit behaviour via routes
// ---------------------------------------------------------------------------

describe('Claims coordination branch', () => {
  it('reads claims.md from the coordination branch (env var)', async () => {
    const originalEnv = process.env.WHEATLEY_COORDINATION_BRANCH;
    process.env.WHEATLEY_COORDINATION_BRANCH = 'coordination';

    try {
      const adapter = createMockAdapter();
      const app = await createServer({ adapter, corsOrigin: true, logger: false });
      await app.ready();

      await app.inject({
        method: 'POST',
        url: '/api/claims',
        body: { itemId: '1.1.1', claimant: 'agent' },
      });

      expect(adapter.readFile).toHaveBeenCalledWith('product-knowledge/claims.md', 'coordination');
      expect(adapter.writeFile).toHaveBeenCalledWith(
        'product-knowledge/claims.md',
        expect.any(String),
        expect.any(String),
        'coordination',
      );

      await app.close();
    } finally {
      if (originalEnv === undefined) {
        delete process.env.WHEATLEY_COORDINATION_BRANCH;
      } else {
        process.env.WHEATLEY_COORDINATION_BRANCH = originalEnv;
      }
    }
  });

  it('falls back to adapter default branch when env var is not set', async () => {
    const originalEnv = process.env.WHEATLEY_COORDINATION_BRANCH;
    delete process.env.WHEATLEY_COORDINATION_BRANCH;

    try {
      const adapter = createMockAdapter();
      const app = await createServer({ adapter, corsOrigin: true, logger: false });
      await app.ready();

      await app.inject({
        method: 'POST',
        url: '/api/claims',
        body: { itemId: '1.1.1', claimant: 'agent' },
      });

      expect(adapter.getDefaultBranch).toHaveBeenCalled();
      expect(adapter.writeFile).toHaveBeenCalledWith(
        'product-knowledge/claims.md',
        expect.any(String),
        expect.any(String),
        'main', // from getDefaultBranch mock
      );

      await app.close();
    } finally {
      if (originalEnv !== undefined) {
        process.env.WHEATLEY_COORDINATION_BRANCH = originalEnv;
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Mock adapter type check — ensures writeFile is part of GitAdapter
// ---------------------------------------------------------------------------

describe('GitAdapter.writeFile interface', () => {
  it('mock adapter satisfies GitAdapter with writeFile', () => {
    const adapter = createMockAdapter();
    // TypeScript-level check: if this compiles, the type is correct
    const fn: WriteFn = adapter.writeFile.bind(adapter);
    expect(typeof fn).toBe('function');
  });
});
