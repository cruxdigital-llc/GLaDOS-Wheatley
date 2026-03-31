import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createServer } from '../server.js';
import type { GitAdapter } from '../../git/types.js';

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
// GET /api/activity
// ---------------------------------------------------------------------------

describe('GET /api/activity', () => {
  let app: FastifyInstance;
  let mockAdapter: GitAdapter;

  beforeAll(async () => {
    mockAdapter = createMockAdapter({
      readFile: vi.fn().mockResolvedValue(
        [
          '# Activity Log',
          '',
          '- [claim] 1.1.1 | jed | 2026-03-28T10:00:00Z',
          '- [transition] 1.1.1 | claude-opus-4 | 2026-03-28T11:00:00Z | planning→speccing',
          '- [commit] specs/foo | jed | 2026-03-28T12:00:00Z',
        ].join('\n'),
      ),
    });
    app = await createServer({ adapter: mockAdapter, corsOrigin: true, logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns all entries newest first', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/activity' });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.entries).toHaveLength(3);
    expect(body.entries[0].action).toBe('commit');
    expect(body.entries[2].action).toBe('claim');
  });

  it('returns actors map', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/activity' });
    const body = response.json();
    expect(body.actors.jed).toBe('human');
    expect(body.actors['claude-opus-4']).toBe('agent');
  });

  it('filters by actor', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/activity?actor=jed' });
    const body = response.json();
    expect(body.entries).toHaveLength(2);
    expect(body.entries.every((e: { actor: string }) => e.actor === 'jed')).toBe(true);
  });

  it('filters by action', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/activity?action=claim' });
    const body = response.json();
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].action).toBe('claim');
  });

  it('limits results', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/activity?limit=2' });
    const body = response.json();
    expect(body.entries).toHaveLength(2);
  });

  it('returns 400 for invalid limit', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/activity?limit=abc' });
    expect(response.statusCode).toBe(400);
  });

  it('returns 400 for invalid action', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/activity?action=deploy' });
    expect(response.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /api/activity
// ---------------------------------------------------------------------------

describe('POST /api/activity', () => {
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
    vi.mocked(mockAdapter.readFile).mockClear().mockResolvedValue(null);
  });

  it('returns 201 for a valid trace entry', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/activity',
      body: { action: 'claim', target: '1.1.1', actor: 'jed' },
    });
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.action).toBe('claim');
    expect(body.actor).toBe('jed');
    expect(body.actorType).toBe('human');
  });

  it('calls writeFile to append to activity.md', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/activity',
      body: { action: 'commit', target: 'specs/foo', actor: 'claude-opus-4', detail: 'added spec' },
    });
    expect(mockAdapter.writeFile).toHaveBeenCalledWith(
      'product-knowledge/activity.md',
      expect.stringContaining('- [commit] specs/foo | claude-opus-4'),
      expect.stringContaining('activity: commit specs/foo by claude-opus-4'),
      undefined,
    );
  });

  it('returns 400 when action is missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/activity',
      body: { target: '1.1.1', actor: 'jed' },
    });
    expect(response.statusCode).toBe(400);
  });

  it('returns 400 when action is invalid', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/activity',
      body: { action: 'deploy', target: '1.1.1', actor: 'jed' },
    });
    expect(response.statusCode).toBe(400);
  });

  it('returns 400 when target is missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/activity',
      body: { action: 'claim', actor: 'jed' },
    });
    expect(response.statusCode).toBe(400);
  });

  it('returns 400 when actor is missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/activity',
      body: { action: 'claim', target: '1.1.1' },
    });
    expect(response.statusCode).toBe(400);
  });
});
