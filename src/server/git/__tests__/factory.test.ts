import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createGitAdapter, configFromEnv } from '../factory.js';
import { LocalGitAdapter } from '../local-adapter.js';
import { RemoteGitAdapter } from '../remote-adapter.js';

describe('createGitAdapter', () => {
  it('creates LocalGitAdapter for local mode', () => {
    const adapter = createGitAdapter({ mode: 'local', localPath: '/repo' });
    expect(adapter).toBeInstanceOf(LocalGitAdapter);
  });

  it('throws if local mode is missing localPath', () => {
    expect(() => createGitAdapter({ mode: 'local' })).toThrow(
      /localPath/,
    );
  });

  it('creates RemoteGitAdapter for remote mode', () => {
    const adapter = createGitAdapter({
      mode: 'remote',
      github: { token: 'ghp_test', owner: 'org', repo: 'repo' },
    });
    expect(adapter).toBeInstanceOf(RemoteGitAdapter);
  });

  it('throws if remote mode is missing github config', () => {
    expect(() => createGitAdapter({ mode: 'remote' })).toThrow(
      /github/,
    );
  });

  it('throws if remote mode has empty token', () => {
    expect(() =>
      createGitAdapter({
        mode: 'remote',
        github: { token: '', owner: 'org', repo: 'repo' },
      }),
    ).toThrow(/token/);
  });

  it('throws if remote mode has empty owner', () => {
    expect(() =>
      createGitAdapter({
        mode: 'remote',
        github: { token: 'ghp_test', owner: '', repo: 'repo' },
      }),
    ).toThrow(/owner/);
  });

  it('throws if remote mode has empty repo', () => {
    expect(() =>
      createGitAdapter({
        mode: 'remote',
        github: { token: 'ghp_test', owner: 'org', repo: '' },
      }),
    ).toThrow(/repo/);
  });

  it('throws for invalid mode', () => {
    expect(() =>
      createGitAdapter({ mode: 'invalid' as 'local' }),
    ).toThrow(/Invalid WHEATLEY_MODE/);
  });
});

describe('configFromEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('creates local config from env', () => {
    process.env.WHEATLEY_MODE = 'local';
    process.env.WHEATLEY_REPO_PATH = '/my/repo';

    const config = configFromEnv();
    expect(config.mode).toBe('local');
    expect(config.localPath).toBe('/my/repo');
  });

  it('creates remote config from env', () => {
    process.env.WHEATLEY_MODE = 'remote';
    process.env.GITHUB_TOKEN = 'ghp_abc';
    process.env.GITHUB_OWNER = 'cruxdigital-llc';
    process.env.GITHUB_REPO = 'GLaDOS-Wheatley';

    const config = configFromEnv();
    expect(config.mode).toBe('remote');
    expect(config.github?.token).toBe('ghp_abc');
    expect(config.github?.owner).toBe('cruxdigital-llc');
    expect(config.github?.repo).toBe('GLaDOS-Wheatley');
  });

  it('throws if WHEATLEY_MODE is not set', () => {
    delete process.env.WHEATLEY_MODE;
    expect(() => configFromEnv()).toThrow(/WHEATLEY_MODE/);
  });

  it('throws for invalid WHEATLEY_MODE', () => {
    process.env.WHEATLEY_MODE = 'hybrid';
    expect(() => configFromEnv()).toThrow(/WHEATLEY_MODE/);
  });
});
