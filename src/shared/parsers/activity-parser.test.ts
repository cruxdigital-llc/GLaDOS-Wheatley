import { describe, it, expect } from 'vitest';
import { parseActivityFeed } from './activity-parser.js';

describe('parseActivityFeed', () => {
  it('returns empty for blank content', () => {
    const result = parseActivityFeed('');
    expect(result.entries).toHaveLength(0);
    expect(result.actors.size).toBe(0);
  });

  it('parses a single trace entry', () => {
    const content = '- [claim] 1.2.3 | jed | 2026-03-28T14:30:00Z';
    const result = parseActivityFeed(content);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toEqual({
      action: 'claim',
      target: '1.2.3',
      actor: 'jed',
      actorType: 'human',
      timestamp: '2026-03-28T14:30:00Z',
      detail: undefined,
    });
  });

  it('parses entries with detail field', () => {
    const content = '- [transition] 1.2.3 | claude-opus-4 | 2026-03-28T14:30:00Z | unclaimed→planning';
    const result = parseActivityFeed(content);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].detail).toBe('unclaimed→planning');
    expect(result.entries[0].actorType).toBe('agent');
  });

  it('parses multiple entries and returns newest first', () => {
    const content = [
      '# Activity Log',
      '',
      '- [claim] 1.1.1 | jed | 2026-03-28T10:00:00Z',
      '- [transition] 1.1.1 | claude-opus-4 | 2026-03-28T11:00:00Z | planning→speccing',
      '- [commit] specs/foo | jed | 2026-03-28T12:00:00Z',
    ].join('\n');

    const result = parseActivityFeed(content);
    expect(result.entries).toHaveLength(3);
    // Newest first (reversed)
    expect(result.entries[0].action).toBe('commit');
    expect(result.entries[1].action).toBe('transition');
    expect(result.entries[2].action).toBe('claim');
  });

  it('populates actors map with identity types', () => {
    const content = [
      '- [claim] 1.1.1 | jed | 2026-03-28T10:00:00Z',
      '- [transition] 1.1.1 | claude-opus-4 | 2026-03-28T11:00:00Z',
    ].join('\n');

    const result = parseActivityFeed(content);
    expect(result.actors.get('jed')).toBe('human');
    expect(result.actors.get('claude-opus-4')).toBe('agent');
  });

  it('skips lines with unknown action types', () => {
    const content = '- [deploy] main | ci | 2026-03-28T14:30:00Z';
    const result = parseActivityFeed(content);
    expect(result.entries).toHaveLength(0);
  });

  it('skips malformed lines', () => {
    const content = [
      '- [claim] 1.1.1 | jed | 2026-03-28T14:30:00Z',
      'This is not a trace line',
      '- incomplete line',
      '- [claim] missing fields',
    ].join('\n');

    const result = parseActivityFeed(content);
    expect(result.entries).toHaveLength(1);
  });

  it('handles GLaDOS header', () => {
    const content = [
      '<!--',
      'GLaDOS-MANAGED DOCUMENT',
      '-->',
      '',
      '# Activity Log',
      '',
      '- [claim] 1.1.1 | jed | 2026-03-28T14:30:00Z',
    ].join('\n');

    const result = parseActivityFeed(content);
    expect(result.entries).toHaveLength(1);
  });

  it('handles all valid action types', () => {
    const actions = ['claim', 'release', 'transition', 'file-create', 'file-edit', 'commit', 'comment'];
    const lines = actions.map(
      (a, i) => `- [${a}] target-${i} | actor | 2026-03-28T14:${String(i).padStart(2, '0')}:00Z`,
    );
    const result = parseActivityFeed(lines.join('\n'));
    expect(result.entries).toHaveLength(7);
  });
});
