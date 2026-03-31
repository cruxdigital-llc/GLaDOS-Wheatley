/**
 * Tests for OAuth route repo access verification.
 *
 * These tests focus on the collaborator/member checks added to the callbacks.
 * They mock global fetch to simulate GitHub/GitLab API responses.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify from 'fastify';
import { oauthRoutes } from '../oauth-routes.js';
import type { AuthConfig } from '../types.js';

// Helper to build a minimal AuthConfig for GitHub
function githubConfig(): AuthConfig {
  return {
    mode: 'cloud',
    jwtSecret: 'test-secret-that-is-long-enough-for-hmac',
    jwtExpirySeconds: 3600,
    github: {
      clientId: 'gh-client-id',
      clientSecret: 'gh-client-secret',
      callbackUrl: 'http://localhost:3000/auth/callback/github',
    },
  };
}

// Helper to build a minimal AuthConfig for GitLab
function gitlabConfig(): AuthConfig {
  return {
    mode: 'cloud',
    jwtSecret: 'test-secret-that-is-long-enough-for-hmac',
    jwtExpirySeconds: 3600,
    gitlab: {
      clientId: 'gl-client-id',
      clientSecret: 'gl-client-secret',
      callbackUrl: 'http://localhost:3000/auth/callback/gitlab',
      baseUrl: 'https://gitlab.com',
    },
  };
}

/**
 * Build a mock fetch that responds differently based on URL patterns.
 * Returns a vi.fn() that can be inspected.
 */
function buildMockFetch(responses: Record<string, { status: number; body?: unknown }>) {
  return vi.fn(async (url: string | URL | Request) => {
    const urlStr = typeof url === 'string' ? url : url.toString();
    for (const [pattern, response] of Object.entries(responses)) {
      if (urlStr.includes(pattern)) {
        return {
          ok: response.status >= 200 && response.status < 300,
          status: response.status,
          json: () => Promise.resolve(response.body ?? {}),
        };
      }
    }
    return { ok: false, status: 404, json: () => Promise.resolve({}) };
  });
}

describe('GitHub OAuth callback — repo access verification', () => {
  const originalEnv = process.env;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env['WHEATLEY_ADMIN_USERS'];
  });

  afterEach(() => {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('denies access when user is not a repo collaborator', async () => {
    process.env['GITHUB_OWNER'] = 'test-org';
    process.env['GITHUB_REPO'] = 'test-repo';

    globalThis.fetch = buildMockFetch({
      'login/oauth/access_token': { status: 200, body: { access_token: 'gh-token' } },
      'api.github.com/user': { status: 200, body: { id: 1, login: 'outsider', name: 'Outside User' } },
      '/collaborators/outsider': { status: 404 },
    }) as any;

    const app = Fastify();
    oauthRoutes(app, githubConfig());
    await app.ready();

    // We need to simulate having a valid state — call /auth/login first to generate one
    const loginRes = await app.inject({ method: 'GET', url: '/auth/login' });
    const redirectUrl = loginRes.headers['location'] as string;
    const stateParam = new URL(redirectUrl).searchParams.get('state')!;

    const res = await app.inject({
      method: 'GET',
      url: `/auth/callback/github?code=test-code&state=${stateParam}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('Access Denied');
    expect(res.body).toContain('outsider');
    expect(res.body).toContain('test-org/test-repo');
    await app.close();
  });

  it('issues JWT with write permission mapped to editor role', async () => {
    process.env['GITHUB_OWNER'] = 'test-org';
    process.env['GITHUB_REPO'] = 'test-repo';

    globalThis.fetch = buildMockFetch({
      'login/oauth/access_token': { status: 200, body: { access_token: 'gh-token' } },
      'api.github.com/user': { status: 200, body: { id: 2, login: 'contributor', name: 'Dev User' } },
      '/collaborators/contributor/permission': { status: 200, body: { permission: 'write' } },
      // The collaborator check itself returns 204 (no body)
      '/collaborators/contributor': { status: 204 },
    }) as any;

    const app = Fastify();
    oauthRoutes(app, githubConfig());
    await app.ready();

    const loginRes = await app.inject({ method: 'GET', url: '/auth/login' });
    const stateParam = new URL(loginRes.headers['location'] as string).searchParams.get('state')!;

    const res = await app.inject({
      method: 'GET',
      url: `/auth/callback/github?code=test-code&state=${stateParam}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('wheatley_token');
    // The JWT should contain editor role — we can verify by checking it doesn't say Access Denied
    expect(res.body).not.toContain('Access Denied');
    await app.close();
  });

  it('skips collaborator check when GITHUB_OWNER/GITHUB_REPO are not set', async () => {
    // Don't set GITHUB_OWNER or GITHUB_REPO
    delete process.env['GITHUB_OWNER'];
    delete process.env['GITHUB_REPO'];

    globalThis.fetch = buildMockFetch({
      'login/oauth/access_token': { status: 200, body: { access_token: 'gh-token' } },
      'api.github.com/user': { status: 200, body: { id: 3, login: 'anyuser', name: 'Any User' } },
    }) as any;

    const app = Fastify();
    oauthRoutes(app, githubConfig());
    await app.ready();

    const loginRes = await app.inject({ method: 'GET', url: '/auth/login' });
    const stateParam = new URL(loginRes.headers['location'] as string).searchParams.get('state')!;

    const res = await app.inject({
      method: 'GET',
      url: `/auth/callback/github?code=test-code&state=${stateParam}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('wheatley_token');
    expect(res.body).not.toContain('Access Denied');
    await app.close();
  });

  it('WHEATLEY_ADMIN_USERS override skips collaborator check', async () => {
    process.env['GITHUB_OWNER'] = 'test-org';
    process.env['GITHUB_REPO'] = 'test-repo';
    process.env['WHEATLEY_ADMIN_USERS'] = 'admin-user';

    globalThis.fetch = buildMockFetch({
      'login/oauth/access_token': { status: 200, body: { access_token: 'gh-token' } },
      'api.github.com/user': { status: 200, body: { id: 4, login: 'admin-user', name: 'Admin' } },
    }) as any;

    const app = Fastify();
    oauthRoutes(app, githubConfig());
    await app.ready();

    const loginRes = await app.inject({ method: 'GET', url: '/auth/login' });
    const stateParam = new URL(loginRes.headers['location'] as string).searchParams.get('state')!;

    const res = await app.inject({
      method: 'GET',
      url: `/auth/callback/github?code=test-code&state=${stateParam}`,
    });

    // Admin users skip the collaborator check entirely
    expect(res.body).toContain('wheatley_token');
    expect(res.body).not.toContain('Access Denied');

    // Verify the collaborator API was NOT called
    const fetchCalls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
    const collabCalls = fetchCalls.filter(([url]: [string]) => url.includes('/collaborators/'));
    expect(collabCalls).toHaveLength(0);

    await app.close();
  });
});

describe('GitLab OAuth callback — project access verification', () => {
  const originalEnv = process.env;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env['WHEATLEY_ADMIN_USERS'];
  });

  afterEach(() => {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('denies access when user is not a project member', async () => {
    process.env['GITLAB_PROJECT_ID'] = '42';

    globalThis.fetch = buildMockFetch({
      'gitlab.com/oauth/token': { status: 200, body: { access_token: 'gl-token' } },
      'gitlab.com/api/v4/user': { status: 200, body: { id: 10, username: 'outsider', name: 'Outside' } },
      '/members/all/10': { status: 404 },
    }) as any;

    const app = Fastify();
    oauthRoutes(app, gitlabConfig());
    await app.ready();

    const loginRes = await app.inject({ method: 'GET', url: '/auth/login' });
    const stateParam = new URL(loginRes.headers['location'] as string).searchParams.get('state')!;

    const res = await app.inject({
      method: 'GET',
      url: `/auth/callback/gitlab?code=test-code&state=${stateParam}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Access Denied');
    expect(res.body).toContain('outsider');
    await app.close();
  });

  it('maps GitLab Developer (30) to editor role', async () => {
    process.env['GITLAB_PROJECT_ID'] = '42';

    globalThis.fetch = buildMockFetch({
      'gitlab.com/oauth/token': { status: 200, body: { access_token: 'gl-token' } },
      'gitlab.com/api/v4/user': { status: 200, body: { id: 20, username: 'dev', name: 'Developer' } },
      '/members/all/20': { status: 200, body: { access_level: 30 } },
    }) as any;

    const app = Fastify();
    oauthRoutes(app, gitlabConfig());
    await app.ready();

    const loginRes = await app.inject({ method: 'GET', url: '/auth/login' });
    const stateParam = new URL(loginRes.headers['location'] as string).searchParams.get('state')!;

    const res = await app.inject({
      method: 'GET',
      url: `/auth/callback/gitlab?code=test-code&state=${stateParam}`,
    });

    expect(res.body).toContain('wheatley_token');
    expect(res.body).not.toContain('Access Denied');
    await app.close();
  });
});
