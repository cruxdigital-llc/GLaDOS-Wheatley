import { describe, it, expect } from 'vitest';

/**
 * Tests for the template resolution logic used by SubprocessRunner
 * to build autonomous workflow prompts.
 */

// ---------------------------------------------------------------------------
// Template resolution (mirrors resolveTemplate in subprocess-runner.ts)
// ---------------------------------------------------------------------------

function resolveTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => vars[key] ?? `[${key}]`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Autonomous Context Template Resolution', () => {
  it('resolves known placeholders', () => {
    const template = 'Feature: {{featureName}}, Goal: {{goal}}';
    const result = resolveTemplate(template, { featureName: 'Auth', goal: 'Add login' });
    expect(result).toBe('Feature: Auth, Goal: Add login');
  });

  it('replaces unknown placeholders with [key] marker', () => {
    const template = 'Unknown: {{unknown}}';
    const result = resolveTemplate(template, {});
    expect(result).toBe('Unknown: [unknown]');
  });

  it('resolves card context variables', () => {
    const template = 'Card {{cardId}}: {{cardTitle}} in {{specDir}}';
    const result = resolveTemplate(template, {
      cardId: '1.2.3',
      cardTitle: 'My Feature',
      specDir: 'specs/2026-04-02_feature_my-feature',
    });
    expect(result).toBe('Card 1.2.3: My Feature in specs/2026-04-02_feature_my-feature');
  });

  it('handles template with no placeholders', () => {
    const result = resolveTemplate('No placeholders here', {});
    expect(result).toBe('No placeholders here');
  });

  it('handles multiple occurrences of the same placeholder', () => {
    const template = '{{name}} likes {{name}}';
    const result = resolveTemplate(template, { name: 'Alice' });
    expect(result).toBe('Alice likes Alice');
  });

  it('handles empty template', () => {
    const result = resolveTemplate('', { key: 'val' });
    expect(result).toBe('');
  });
});

describe('Prompt Assembly', () => {
  // Simulates how buildArgs assembles the prompt
  function assemblePrompt(parts: { preamble?: string; command: string; context?: string; postamble?: string }): string {
    const sections: string[] = [];
    if (parts.preamble) sections.push(parts.preamble);
    sections.push(parts.command);
    if (parts.context) sections.push(parts.context);
    if (parts.postamble) sections.push(parts.postamble);
    return sections.join('\n\n');
  }

  it('assembles all four sections', () => {
    const result = assemblePrompt({
      preamble: 'Run in Docker.',
      command: 'Run /glados:plan-feature for card 1.2.3',
      context: 'Feature Name: Auth',
      postamble: 'Commit when done.',
    });
    expect(result).toBe(
      'Run in Docker.\n\nRun /glados:plan-feature for card 1.2.3\n\nFeature Name: Auth\n\nCommit when done.',
    );
  });

  it('skips missing optional sections', () => {
    const result = assemblePrompt({
      command: 'Run /glados:verify-feature for specs/foo',
    });
    expect(result).toBe('Run /glados:verify-feature for specs/foo');
  });

  it('includes preamble and postamble without context', () => {
    const result = assemblePrompt({
      preamble: 'Use Docker.',
      command: 'Run /glados:implement-feature for specs/bar',
      postamble: 'Run tests.',
    });
    expect(result).toBe('Use Docker.\n\nRun /glados:implement-feature for specs/bar\n\nRun tests.');
  });
});
