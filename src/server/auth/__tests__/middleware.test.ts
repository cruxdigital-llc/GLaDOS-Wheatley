import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { authMiddleware, _resetCachedLocalIdentity } from '../middleware.js';
import type { AuthConfig } from '../types.js';
import type { GitAdapter } from '../../git/types.js';

/** Minimal mock of FastifyRequest */
function mockRequest(): { user?: unknown; headers: Record<string, string> } {
  return { headers: {} };
}

/** Minimal mock of FastifyReply */
function mockReply() {
  const reply = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      reply.statusCode = code;
      return reply;
    },
    send(body: unknown) {
      reply.body = body;
      return reply;
    },
  };
  return reply;
}

function localConfig(): AuthConfig {
  return {
    mode: 'local',
    jwtSecret: 'test-secret',
    jwtExpirySeconds: 86400,
  };
}

/** Minimal GitAdapter mock — only getGitIdentity is needed */
function mockAdapter(name: string | null, email: string | null): GitAdapter {
  return {
    getGitIdentity: vi.fn().mockResolvedValue({ name, email }),
  } as unknown as GitAdapter;
}

describe('authMiddleware — local mode identity resolution', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env['WHEATLEY_COMMIT_AUTHOR'];
    _resetCachedLocalIdentity();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('uses git config identity when no env var is set', async () => {
    const adapter = mockAdapter('Jane Dev', 'jane@dev.co');
    const hook = authMiddleware(localConfig(), adapter);

    const req = mockRequest();
    const reply = mockReply();
    await hook(req as any, reply as any);

    expect(req.user).toMatchObject({
      id: 'local',
      name: 'Jane Dev',
      email: 'jane@dev.co',
      provider: 'local',
      role: 'editor',
    });
    expect(adapter.getGitIdentity).toHaveBeenCalledOnce();
  });

  it('prefers WHEATLEY_COMMIT_AUTHOR env var over git config', async () => {
    process.env['WHEATLEY_COMMIT_AUTHOR'] = 'Env User <env@test.com>';
    const adapter = mockAdapter('Git User', 'git@test.com');
    const hook = authMiddleware(localConfig(), adapter);

    const req = mockRequest();
    const reply = mockReply();
    await hook(req as any, reply as any);

    expect(req.user).toMatchObject({
      name: 'Env User',
      email: 'env@test.com',
    });
    // Should NOT call git config when env var is present
    expect(adapter.getGitIdentity).not.toHaveBeenCalled();
  });

  it('falls back to "Local User" when git config returns nulls', async () => {
    const adapter = mockAdapter(null, null);
    const hook = authMiddleware(localConfig(), adapter);

    const req = mockRequest();
    const reply = mockReply();
    await hook(req as any, reply as any);

    expect(req.user).toMatchObject({
      name: 'Local User',
      email: undefined,
    });
  });

  it('falls back to "Local User" when no adapter is provided', async () => {
    const hook = authMiddleware(localConfig());

    const req = mockRequest();
    const reply = mockReply();
    await hook(req as any, reply as any);

    expect(req.user).toMatchObject({
      name: 'Local User',
    });
  });

  it('caches identity across requests (only calls adapter once)', async () => {
    const adapter = mockAdapter('Cached User', 'cached@test.com');
    const hook = authMiddleware(localConfig(), adapter);

    const req1 = mockRequest();
    const req2 = mockRequest();
    const reply = mockReply();

    await hook(req1 as any, reply as any);
    await hook(req2 as any, reply as any);

    expect(adapter.getGitIdentity).toHaveBeenCalledOnce();
    expect(req1.user).toMatchObject({ name: 'Cached User' });
    expect(req2.user).toMatchObject({ name: 'Cached User' });
  });

  it('handles adapter.getGitIdentity() throwing gracefully', async () => {
    const adapter = {
      getGitIdentity: vi.fn().mockRejectedValue(new Error('git not found')),
    } as unknown as GitAdapter;
    const hook = authMiddleware(localConfig(), adapter);

    const req = mockRequest();
    const reply = mockReply();
    await hook(req as any, reply as any);

    expect(req.user).toMatchObject({
      name: 'Local User',
      email: undefined,
    });
  });
});
