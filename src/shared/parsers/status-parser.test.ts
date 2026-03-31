import { describe, it, expect } from 'vitest';
import { parseProjectStatus } from './status-parser.js';

const SAMPLE_STATUS = `<!--
GLaDOS-MANAGED DOCUMENT
-->

# GLaDOS System Status

## Project Overview

**Mission**: Wheatley
**Current Phase**: Planning

Description.

## Architecture

Some architecture.

## Current Focus

### 1. Phase 1 — MVP

*Lead: TBD*

- [ ] **Parser**: Extract items from ROADMAP.md
- [x] **Scaffold**: Set up project structure
- [ ] **Board UI**: Column-based view

### 2. Backlog / Upcoming

- [ ] **Phase 2**: Claims & Assignment
- [ ] **Phase 3**: Phase Transitions

## Known Issues / Technical Debt

None yet.

## Recent Changes

- 2026-03-28: Project initialized.
`;

describe('parseProjectStatus', () => {
  it('extracts active tasks from focus sections', () => {
    const result = parseProjectStatus(SAMPLE_STATUS);
    expect(result.activeTasks).toHaveLength(3);
    expect(result.activeTasks[0].label).toBe('Parser');
    expect(result.activeTasks[0].description).toBe('Extract items from ROADMAP.md');
    expect(result.activeTasks[0].completed).toBe(false);
  });

  it('detects completed tasks', () => {
    const result = parseProjectStatus(SAMPLE_STATUS);
    expect(result.activeTasks[1].label).toBe('Scaffold');
    expect(result.activeTasks[1].completed).toBe(true);
  });

  it('attaches lead to tasks', () => {
    const result = parseProjectStatus(SAMPLE_STATUS);
    expect(result.activeTasks[0].lead).toBe('TBD');
    expect(result.activeTasks[0].section).toBe('Phase 1 — MVP');
  });

  it('separates backlog from active tasks', () => {
    const result = parseProjectStatus(SAMPLE_STATUS);
    expect(result.backlog).toHaveLength(2);
    expect(result.backlog[0].label).toBe('Phase 2');
  });

  it('returns empty results for empty content', () => {
    const result = parseProjectStatus('');
    expect(result.activeTasks).toHaveLength(0);
    expect(result.backlog).toHaveLength(0);
  });

  it('handles CRLF line endings', () => {
    const content = SAMPLE_STATUS.replace(/\n/g, '\r\n');
    const result = parseProjectStatus(content);
    expect(result.activeTasks).toHaveLength(3);
  });

  it('handles status without Current Focus section', () => {
    const content = `# Status\n\n## Project Overview\n\nText.\n`;
    const result = parseProjectStatus(content);
    expect(result.activeTasks).toHaveLength(0);
  });
});
