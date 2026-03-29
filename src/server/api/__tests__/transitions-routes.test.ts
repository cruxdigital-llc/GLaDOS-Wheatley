import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createServer } from '../server.js';
import type { GitAdapter } from '../../git/types.js';
import { ConflictError } from '../../git/types.js';

// ---------------------------------------------------------------------------
// Mock adapter factory
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// POST /api/transitions — success cases
// ---------------------------------------------------------------------------

describe('POST /api/transitions — success cases', () => {
  let app: FastifyInstance;
  let mockAdapter: GitAdapter;

  beforeAll(async () => {
    mockAdapter = createMockAdapter();
    app = await createServer({ adapter: mockAdapter, corsOrigin: true, logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.mocked(mockAdapter.writeFile).mockClear().mockResolvedValue(undefined);
  });

  it('returns 200 for a valid unclaimed → planning transition', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/transitions',
      body: { itemId: '3.1.2', from: 'unclaimed', to: 'planning' },
    });

    expect(response.statusCode).toBe(200);
  });

  it('calls writeFile at least once for unclaimed → planning', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/transitions',
      body: { itemId: '3.1.2', from: 'unclaimed', to: 'planning' },
    });

    expect(mockAdapter.writeFile).toHaveBeenCalled();
  });

  it('uses machine-parseable commit message with unicode arrow', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/transitions',
      body: { itemId: '3.1.2', from: 'unclaimed', to: 'planning' },
    });

    expect(mockAdapter.writeFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      'transition: 3.1.2 unclaimed\u2192planning',
      undefined,
    );
  });

  it('returns 200 for planning → speccing and calls writeFile twice', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/transitions',
      body: { itemId: '3.1.2', from: 'planning', to: 'speccing' },
    });

    expect(response.statusCode).toBe(200);
    // planning→speccing produces spec.md + requirements.md
    expect(mockAdapter.writeFile).toHaveBeenCalledTimes(2);
  });

  it('forwards optional branch to writeFile', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/transitions',
      body: { itemId: '3.1.2', from: 'unclaimed', to: 'planning', branch: 'feat/my-branch' },
    });

    expect(mockAdapter.writeFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(String),
      'feat/my-branch',
    );
  });

  it('returns 200 for unclaimed → implementing shortcut (two file writes)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/transitions',
      body: { itemId: '3.1.2', from: 'unclaimed', to: 'implementing' },
    });

    expect(response.statusCode).toBe(200);
    expect(mockAdapter.writeFile).toHaveBeenCalledTimes(2);
  });

  it('returns 200 for verifying → done', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/transitions',
      body: { itemId: '3.1.2', from: 'verifying', to: 'done' },
    });

    expect(response.statusCode).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// POST /api/transitions — 400 bad request cases
// ---------------------------------------------------------------------------

describe('POST /api/transitions — 400 bad request', () => {
  let app: FastifyInstance;
  let mockAdapter: GitAdapter;

  beforeAll(async () => {
    mockAdapter = createMockAdapter();
    app = await createServer({ adapter: mockAdapter, corsOrigin: true, logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 400 when itemId is missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/transitions',
      body: { from: 'unclaimed', to: 'planning' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 400 when from is missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/transitions',
      body: { itemId: '3.1.2', to: 'planning' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 400 when to is missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/transitions',
      body: { itemId: '3.1.2', from: 'unclaimed' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 400 when from is an unknown phase', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/transitions',
      body: { itemId: '3.1.2', from: 'unknown-phase', to: 'planning' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 400 when to is an unknown phase', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/transitions',
      body: { itemId: '3.1.2', from: 'unclaimed', to: 'deployed' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 400 for invalid transition unclaimed → done', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/transitions',
      body: { itemId: '3.1.2', from: 'unclaimed', to: 'done' },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error).toBe('Bad Request');
  });

  it('returns 400 for backward transition planning → unclaimed', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/transitions',
      body: { itemId: '3.1.2', from: 'planning', to: 'unclaimed' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 400 for same-phase transition implementing → implementing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/transitions',
      body: { itemId: '3.1.2', from: 'implementing', to: 'implementing' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 400 when branch is not a string', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/transitions',
      body: { itemId: '3.1.2', from: 'unclaimed', to: 'planning', branch: 42 },
    });

    expect(response.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /api/transitions — 409 conflict
// ---------------------------------------------------------------------------

describe('POST /api/transitions — 409 conflict', () => {
  let app: FastifyInstance;
  let mockAdapter: GitAdapter;

  beforeAll(async () => {
    mockAdapter = createMockAdapter();
    app = await createServer({ adapter: mockAdapter, corsOrigin: true, logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.mocked(mockAdapter.writeFile).mockClear().mockResolvedValue(undefined);
  });

  it('returns 409 with conflict:true when adapter throws ConflictError', async () => {
    vi.mocked(mockAdapter.writeFile).mockRejectedValue(
      new ConflictError('Push rejected: non-fast-forward'),
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/transitions',
      body: { itemId: '3.1.2', from: 'unclaimed', to: 'planning' },
    });

    expect(response.statusCode).toBe(409);
    const body = response.json();
    expect(body.conflict).toBe(true);
    expect(body.error).toBe('Conflict');
  });

  it('returns 500 on unexpected adapter errors', async () => {
    vi.mocked(mockAdapter.writeFile).mockRejectedValue(new Error('Disk full'));

    const response = await app.inject({
      method: 'POST',
      url: '/api/transitions',
      body: { itemId: '3.1.2', from: 'unclaimed', to: 'planning' },
    });

    expect(response.statusCode).toBe(500);
  });
});
