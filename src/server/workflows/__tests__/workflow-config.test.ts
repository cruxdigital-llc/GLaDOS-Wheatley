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
      plan: { defaultMode: 'autonomous' },
      verify: { showLaunchPanel: true },
    }));
    const config = await loadWorkflowConfig(adapter);
    expect(config.plan?.defaultMode).toBe('autonomous');
    expect(config.plan?.showLaunchPanel).toBe(true); // kept from default
    expect(config.verify?.showLaunchPanel).toBe(true); // overridden
    expect(config.spec?.defaultMode).toBe('interactive'); // untouched default
  });

  it('merges autoAnswers from config file', async () => {
    const adapter = createMockAdapter(JSON.stringify({
      plan: {
        autoAnswers: { 'feature name': 'My Feature' },
      },
    }));
    const config = await loadWorkflowConfig(adapter);
    expect(config.plan?.autoAnswers).toEqual({ 'feature name': 'My Feature' });
  });

  it('ignores unknown workflow types', async () => {
    const adapter = createMockAdapter(JSON.stringify({
      unknown_type: { defaultMode: 'autonomous' },
    }));
    const config = await loadWorkflowConfig(adapter);
    expect(config).toEqual(DEFAULT_WORKFLOW_CONFIGS);
  });
});

describe('getWorkflowTypeConfig', () => {
  it('returns config for a known type', () => {
    const config = getWorkflowTypeConfig(DEFAULT_WORKFLOW_CONFIGS, 'plan');
    expect(config.defaultMode).toBe('interactive');
    expect(config.showLaunchPanel).toBe(true);
  });

  it('returns default config for unknown type', () => {
    const config = getWorkflowTypeConfig({}, 'plan');
    expect(config.defaultMode).toBe('interactive');
    expect(config.showLaunchPanel).toBe(true);
  });
});
