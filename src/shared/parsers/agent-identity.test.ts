import { describe, it, expect } from 'vitest';
import { identifyAgent } from './agent-identity.js';

describe('identifyAgent', () => {
  it('returns "agent" for names containing "claude"', () => {
    expect(identifyAgent('claude-opus-4')).toBe('agent');
    expect(identifyAgent('Claude Code')).toBe('agent');
  });

  it('returns "agent" for names containing "bot"', () => {
    expect(identifyAgent('dependabot')).toBe('agent');
    expect(identifyAgent('my-bot')).toBe('agent');
  });

  it('returns "agent" for "github-actions"', () => {
    expect(identifyAgent('github-actions[bot]')).toBe('agent');
  });

  it('returns "agent" for names containing "glados"', () => {
    expect(identifyAgent('GLaDOS')).toBe('agent');
  });

  it('returns "agent" for names containing "agent"', () => {
    expect(identifyAgent('build-agent-1')).toBe('agent');
  });

  it('returns "human" for normal human names', () => {
    expect(identifyAgent('jed')).toBe('human');
    expect(identifyAgent('Alice Smith')).toBe('human');
    expect(identifyAgent('developer')).toBe('human');
  });

  it('returns "unknown" for empty or whitespace-only names', () => {
    expect(identifyAgent('')).toBe('unknown');
    expect(identifyAgent('   ')).toBe('unknown');
  });

  it('accepts custom patterns', () => {
    const custom = [/^ci-/i];
    expect(identifyAgent('ci-runner', custom)).toBe('agent');
    expect(identifyAgent('claude-opus-4', custom)).toBe('human'); // default patterns not used
  });
});
