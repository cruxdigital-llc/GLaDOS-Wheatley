import { describe, it, expect, vi } from 'vitest';
import { loadWorkflowConfig, getWorkflowTypeConfig, DEFAULT_WORKFLOW_CONFIGS } from '../config.js';
import type { GitAdapter } from '../../git/types.js';

function createMockAdapter(readResult: string | null = null): GitAdapter {
  return {
    readFile: vi.fn().mockResolvedValue(readResult),
    listDirectory: vi.fn().mockResolvedValue([]),
    listBranches: vi.fn().mockResolvedValue(['main']),
    getCurrentBranch: vi.fn().mockResolvedValue('main'),
    getDefaultBranch: vi.fn().mockResolvedValue('main'),
    getLatestSha: vi.fn().mockResolvedValue('abc123'),
    writeFile: vi.fn().mockResolvedValue(undefined),
  };
}

describe('loadWorkflowConfig', () => {
  it('returns defaults when config file does not exist', async () => {
    const adapter = createMockAdapter(null);
    const config = await loadWorkflowConfig(adapter);
    expect(config).toEqual(DEFAULT_WORKFLOW_CONFIGS);
  });

  it('returns defaults when config file is invalid JSON', async () => {
    const adapter = createMockAdapter('not json');
    const config = await loadWorkflowConfig(adapter);
    expect(config).toEqual(DEFAULT_WORKFLOW_CONFIGS);
  });

  it('merges overrides from config file', async () => {
    const adapter = createMockAdapter(JSON.stringify({
      plan: { showLaunchPanel: false },
      verify: { showLaunchPanel: false },
    }));
    const config = await loadWorkflowConfig(adapter);
    expect(config.plan?.showLaunchPanel).toBe(false);
    expect(config.verify?.showLaunchPanel).toBe(false);
    expect(config.spec?.showLaunchPanel).toBe(true); // untouched default
  });

  it('merges preamble and postamble from config file', async () => {
    const adapter = createMockAdapter(JSON.stringify({
      implement: {
        preamble: 'Use Docker for everything.',
        postamble: 'Run tests when done.',
      },
    }));
    const config = await loadWorkflowConfig(adapter);
    expect(config.implement?.preamble).toBe('Use Docker for everything.');
    expect(config.implement?.postamble).toBe('Run tests when done.');
  });

  it('ignores unknown workflow types', async () => {
    const adapter = createMockAdapter(JSON.stringify({
      unknown_type: { showLaunchPanel: false },
    }));
    const config = await loadWorkflowConfig(adapter);
    expect(config).toEqual(DEFAULT_WORKFLOW_CONFIGS);
  });
});

describe('getWorkflowTypeConfig', () => {
  it('returns config for a known type', () => {
    const config = getWorkflowTypeConfig(DEFAULT_WORKFLOW_CONFIGS, 'plan');
    expect(config.showLaunchPanel).toBe(true);
  });

  it('returns default config for unknown type', () => {
    const config = getWorkflowTypeConfig({}, 'plan');
    expect(config.showLaunchPanel).toBe(true);
  });

  it('plan config has autonomousContext with placeholders', () => {
    const config = getWorkflowTypeConfig(DEFAULT_WORKFLOW_CONFIGS, 'plan');
    expect(config.autonomousContext).toBeDefined();
    expect(config.autonomousContext).toContain('{{featureName}}');
    expect(config.autonomousContext).toContain('{{goal}}');
    expect(config.autonomousContext).toContain('{{personas}}');
  });

  it('plan config has featureName, goal, and personas params', () => {
    const config = getWorkflowTypeConfig(DEFAULT_WORKFLOW_CONFIGS, 'plan');
    const keys = config.params.map((p) => p.key);
    expect(keys).toContain('featureName');
    expect(keys).toContain('goal');
    expect(keys).toContain('personas');
  });

  it('all workflow types have params defined', () => {
    for (const type of ['plan', 'spec', 'implement', 'verify'] as const) {
      const config = getWorkflowTypeConfig(DEFAULT_WORKFLOW_CONFIGS, type);
      expect(config.params.length).toBeGreaterThan(0);
    }
  });

  it('all workflow types have autonomousContext defined', () => {
    for (const type of ['plan', 'spec', 'implement', 'verify'] as const) {
      const config = getWorkflowTypeConfig(DEFAULT_WORKFLOW_CONFIGS, type);
      expect(config.autonomousContext).toBeDefined();
      expect(config.autonomousContext!.length).toBeGreaterThan(0);
    }
  });
});
