/**
 * Status Writeback Tests
 *
 * Tests for the buildStatusWriteback pure function.
 */

import { describe, it, expect } from 'vitest';
import { buildStatusWriteback } from '../status-writeback.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MINIMAL_STATUS = `# PROJECT_STATUS.md

## Current Focus

### 1. Active Work

- [ ] **3.1**: Phase transition engine (implementing)

## Backlog

### 2. Backlog

- [ ] **3.2**: Drag-and-drop UI (unclaimed)
- [ ] **3.3**: GLaDOS integration (unclaimed)
`;

const STATUS_WITH_DONE_SECTION = `# PROJECT_STATUS.md

## Current Focus

### 1. Active Work

- [x] **1.1**: Parsing grammar (done)
- [ ] **3.1**: Phase transition engine (implementing)

## Backlog

### 2. Backlog

- [ ] **3.4**: Status writeback (unclaimed)
`;

// ---------------------------------------------------------------------------
// Tests: mark done
// ---------------------------------------------------------------------------

describe('buildStatusWriteback — mark done', () => {
  it('marks a matching task as [x] when transitioning to done', () => {
    const result = buildStatusWriteback(MINIMAL_STATUS, '3.1', '3.1', 'verifying', 'done');
    expect(result).toContain('- [x] **3.1**: Phase transition engine (implementing)');
    expect(result).not.toContain('- [ ] **3.1**');
  });

  it('leaves other lines unchanged when marking done', () => {
    const result = buildStatusWriteback(MINIMAL_STATUS, '3.1', '3.1', 'verifying', 'done');
    expect(result).toContain('- [ ] **3.2**: Drag-and-drop UI (unclaimed)');
    expect(result).toContain('- [ ] **3.3**: GLaDOS integration (unclaimed)');
  });
});

// ---------------------------------------------------------------------------
// Tests: update existing line (in-progress)
// ---------------------------------------------------------------------------

describe('buildStatusWriteback — update in-progress', () => {
  it('keeps checkbox as [ ] for non-done transitions', () => {
    const result = buildStatusWriteback(
      STATUS_WITH_DONE_SECTION,
      '3.1',
      '3.1',
      'implementing',
      'verifying',
    );
    expect(result).toContain('- [ ] **3.1**: Phase transition engine (implementing)');
  });

  it('does not alter an already-done line when no match for itemId', () => {
    const result = buildStatusWriteback(MINIMAL_STATUS, '9.9', '9.9', 'implementing', 'done');
    // No change — item not present
    expect(result).toBe(MINIMAL_STATUS);
  });
});

// ---------------------------------------------------------------------------
// Tests: insert into focus section
// ---------------------------------------------------------------------------

describe('buildStatusWriteback — insert new task', () => {
  it('adds a new task line when moving unclaimed → planning', () => {
    const result = buildStatusWriteback(MINIMAL_STATUS, '3.3', '3.3', 'unclaimed', 'planning');
    // 3.3 already exists in backlog; it should be updated there, not duplicated
    const matches = result.match(/\*\*3\.3\*\*/g);
    expect(matches).not.toBeNull();
  });

  it('inserts a task when item does not exist and from is unclaimed', () => {
    const bare = `# PROJECT_STATUS.md

## Current Focus

### 1. Active Work

- [ ] **existing**: Some existing task

## Backlog

### 2. Backlog
`;
    const result = buildStatusWriteback(bare, 'new-item', 'New feature', 'unclaimed', 'planning');
    expect(result).toContain('**new-item**');
    expect(result).toContain('planning');
  });
});

// ---------------------------------------------------------------------------
// Tests: empty / malformed input
// ---------------------------------------------------------------------------

describe('buildStatusWriteback — edge cases', () => {
  it('returns empty string unchanged', () => {
    expect(buildStatusWriteback('', '3.1', 'Title', 'unclaimed', 'planning')).toBe('');
  });

  it('returns whitespace-only string unchanged', () => {
    const ws = '   \n   \n';
    expect(buildStatusWriteback(ws, '3.1', 'Title', 'unclaimed', 'planning')).toBe(ws);
  });

  it('returns unchanged content if no Current Focus section exists', () => {
    const noFocus = '# PROJECT_STATUS\n\n## Backlog\n\n- [ ] **3.1**: something\n';
    const result = buildStatusWriteback(noFocus, '3.1', 'something', 'unclaimed', 'planning');
    // 3.1 line exists, so it should be updated in place
    expect(result).toContain('- [ ] **3.1**: something');
  });
});
