import { describe, it, expect } from 'vitest';
import { parseSpecDirectories } from './spec-parser.js';

describe('parseSpecDirectories', () => {
  it('parses valid feature directories', () => {
    const result = parseSpecDirectories([
      {
        dirName: '2026-03-28_feature_parsing-grammar',
        files: ['README.md', 'requirements.md', 'plan.md'],
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2026-03-28');
    expect(result[0].prefix).toBe('feature');
    expect(result[0].name).toBe('parsing-grammar');
    expect(result[0].phase).toBe('planning');
  });

  it('detects phase from files present', () => {
    const result = parseSpecDirectories([
      {
        dirName: '2026-03-28_feature_board-ui',
        files: ['README.md', 'requirements.md', 'plan.md', 'spec.md'],
      },
    ]);
    expect(result[0].phase).toBe('speccing');
  });

  it('detects implementing phase', () => {
    const result = parseSpecDirectories([
      {
        dirName: '2026-03-28_feature_api-server',
        files: ['README.md', 'requirements.md', 'plan.md', 'spec.md', 'tasks.md'],
        tasksContent: '- [ ] Task 1\n- [x] Task 2\n',
      },
    ]);
    expect(result[0].phase).toBe('implementing');
  });

  it('detects done phase when all tasks complete', () => {
    const result = parseSpecDirectories([
      {
        dirName: '2026-03-28_feature_complete',
        files: ['README.md', 'requirements.md', 'plan.md', 'spec.md', 'tasks.md'],
        tasksContent: '- [x] Task 1\n- [x] Task 2\n',
      },
    ]);
    expect(result[0].phase).toBe('done');
  });

  it('detects done phase with readme content too', () => {
    const result = parseSpecDirectories([
      {
        dirName: '2026-03-28_feature_done',
        files: ['README.md', 'requirements.md', 'plan.md', 'spec.md', 'tasks.md'],
        tasksContent: '- [x] Task 1\n- [x] Task 2\n',
        readmeContent: '## Trace\n\n### Verify session\nAll verified.',
      },
    ]);
    expect(result[0].phase).toBe('done');
  });

  it('skips directories with non-matching names', () => {
    const result = parseSpecDirectories([
      { dirName: 'random-directory', files: ['README.md'] },
      { dirName: '2026-03-28_feature_valid', files: ['README.md'] },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('valid');
  });

  it('returns empty array for empty input', () => {
    expect(parseSpecDirectories([])).toHaveLength(0);
  });

  it('parses fix prefix', () => {
    const result = parseSpecDirectories([
      { dirName: '2026-03-28_fix_broken-parser', files: ['README.md'] },
    ]);
    expect(result[0].prefix).toBe('fix');
  });

  it('handles unclaimed spec (only README)', () => {
    const result = parseSpecDirectories([
      { dirName: '2026-03-28_feature_new-thing', files: ['README.md'] },
    ]);
    expect(result[0].phase).toBe('unclaimed');
  });
});
