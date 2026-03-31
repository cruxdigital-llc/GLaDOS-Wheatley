import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadAuthConfig } from '../config.js';

describe('loadAuthConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Clear all auth-related env vars
    delete process.env['WHEATLEY_JWT_SECRET'];
    delete process.env['GITHUB_CLIENT_ID'];
    delete process.env['GITHUB_CLIENT_SECRET'];
    delete process.env['GITHUB_OAUTH_CALLBACK'];
    delete process.env['GITLAB_CLIENT_ID'];
    delete process.env['GITLAB_CLIENT_SECRET'];
    delete process.env['GITLAB_OAUTH_CALLBACK'];
    delete process.env['GITLAB_BASE_URL'];
    delete process.env['WHEATLEY_JWT_EXPIRY'];
    delete process.env['WHEATLEY_API_KEY'];
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('returns local mode with auto-generated secret when no auth vars set', () => {
    const config = loadAuthConfig();
    expect(config.mode).toBe('local');
    expect(config.jwtSecret).toBeTruthy();
    expect(config.jwtSecret.length).toBeGreaterThan(0);
    expect(config.github).toBeUndefined();
    expect(config.gitlab).toBeUndefined();
  });

  it('returns cloud mode when WHEATLEY_JWT_SECRET is set', () => {
    process.env['WHEATLEY_JWT_SECRET'] = 'test-secret';
    process.env['WHEATLEY_API_KEY'] = 'test-api-key';

    const config = loadAuthConfig();
    expect(config.mode).toBe('cloud');
    expect(config.jwtSecret).toBe('test-secret');
  });

  it('throws when GITHUB_CLIENT_ID is set without WHEATLEY_JWT_SECRET', () => {
    process.env['GITHUB_CLIENT_ID'] = 'some-client-id';

    expect(() => loadAuthConfig()).toThrow(/WHEATLEY_JWT_SECRET/);
  });

  it('throws when GITLAB_CLIENT_ID is set without WHEATLEY_JWT_SECRET', () => {
    process.env['GITLAB_CLIENT_ID'] = 'some-client-id';

    expect(() => loadAuthConfig()).toThrow(/WHEATLEY_JWT_SECRET/);
  });

  it('throws when cloud mode has no viable auth method', () => {
    process.env['WHEATLEY_JWT_SECRET'] = 'test-secret';
    // No OAuth providers configured, no API key

    expect(() => loadAuthConfig()).toThrow(/at least one authentication method/);
  });

  it('returns cloud config with full GitHub OAuth', () => {
    process.env['WHEATLEY_JWT_SECRET'] = 'test-secret';
    process.env['GITHUB_CLIENT_ID'] = 'gh-id';
    process.env['GITHUB_CLIENT_SECRET'] = 'gh-secret';
    process.env['GITHUB_OAUTH_CALLBACK'] = 'http://localhost:3000/auth/callback/github';

    const config = loadAuthConfig();
    expect(config.mode).toBe('cloud');
    expect(config.github).toEqual({
      clientId: 'gh-id',
      clientSecret: 'gh-secret',
      callbackUrl: 'http://localhost:3000/auth/callback/github',
    });
  });

  it('returns cloud config with full GitLab OAuth', () => {
    process.env['WHEATLEY_JWT_SECRET'] = 'test-secret';
    process.env['GITLAB_CLIENT_ID'] = 'gl-id';
    process.env['GITLAB_CLIENT_SECRET'] = 'gl-secret';
    process.env['GITLAB_OAUTH_CALLBACK'] = 'http://localhost:3000/auth/callback/gitlab';

    const config = loadAuthConfig();
    expect(config.mode).toBe('cloud');
    expect(config.gitlab).toEqual({
      clientId: 'gl-id',
      clientSecret: 'gl-secret',
      callbackUrl: 'http://localhost:3000/auth/callback/gitlab',
      baseUrl: 'https://gitlab.com',
    });
  });

  it('uses custom GitLab base URL when provided', () => {
    process.env['WHEATLEY_JWT_SECRET'] = 'test-secret';
    process.env['GITLAB_CLIENT_ID'] = 'gl-id';
    process.env['GITLAB_CLIENT_SECRET'] = 'gl-secret';
    process.env['GITLAB_OAUTH_CALLBACK'] = 'http://localhost:3000/auth/callback/gitlab';
    process.env['GITLAB_BASE_URL'] = 'https://gitlab.example.com';

    const config = loadAuthConfig();
    expect(config.gitlab?.baseUrl).toBe('https://gitlab.example.com');
  });

  it('sets github to undefined with partial OAuth config and warns', () => {
    process.env['WHEATLEY_JWT_SECRET'] = 'test-secret';
    process.env['WHEATLEY_API_KEY'] = 'test-key';
    process.env['GITHUB_CLIENT_ID'] = 'gh-id';
    // Missing GITHUB_CLIENT_SECRET and GITHUB_OAUTH_CALLBACK

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const config = loadAuthConfig();

    expect(config.github).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('GitHub OAuth is incomplete'),
    );
  });

  it('sets gitlab to undefined with partial OAuth config and warns', () => {
    process.env['WHEATLEY_JWT_SECRET'] = 'test-secret';
    process.env['WHEATLEY_API_KEY'] = 'test-key';
    process.env['GITLAB_CLIENT_ID'] = 'gl-id';
    // Missing GITLAB_CLIENT_SECRET and GITLAB_OAUTH_CALLBACK

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const config = loadAuthConfig();

    expect(config.gitlab).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('GitLab OAuth is incomplete'),
    );
  });

  it('allows cloud mode with only API key auth', () => {
    process.env['WHEATLEY_JWT_SECRET'] = 'test-secret';
    process.env['WHEATLEY_API_KEY'] = 'my-api-key';

    const config = loadAuthConfig();
    expect(config.mode).toBe('cloud');
    expect(config.apiKey).toBe('my-api-key');
    expect(config.github).toBeUndefined();
    expect(config.gitlab).toBeUndefined();
  });

  it('defaults jwtExpirySeconds to 86400', () => {
    const config = loadAuthConfig();
    expect(config.jwtExpirySeconds).toBe(86400);
  });

  it('parses custom WHEATLEY_JWT_EXPIRY', () => {
    process.env['WHEATLEY_JWT_EXPIRY'] = '3600';
    const config = loadAuthConfig();
    expect(config.jwtExpirySeconds).toBe(3600);
  });

  it('throws on non-numeric WHEATLEY_JWT_EXPIRY', () => {
    process.env['WHEATLEY_JWT_EXPIRY'] = 'one_day';
    expect(() => loadAuthConfig()).toThrow(/WHEATLEY_JWT_EXPIRY must be a positive integer/);
  });

  it('throws on negative WHEATLEY_JWT_EXPIRY', () => {
    process.env['WHEATLEY_JWT_EXPIRY'] = '-100';
    expect(() => loadAuthConfig()).toThrow(/WHEATLEY_JWT_EXPIRY must be a positive integer/);
  });

  it('throws on zero WHEATLEY_JWT_EXPIRY', () => {
    process.env['WHEATLEY_JWT_EXPIRY'] = '0';
    expect(() => loadAuthConfig()).toThrow(/WHEATLEY_JWT_EXPIRY must be a positive integer/);
  });
});
