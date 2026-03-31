import { describe, it, expect } from 'vitest';
import { parseRoadmap } from './roadmap-parser.js';

const SAMPLE_ROADMAP = `<!--
GLaDOS-MANAGED DOCUMENT
Last Updated: 2026-03-28
-->

# Roadmap

## Phase 1: Read-Only Board

**Goal**: Parse GLaDOS artifacts and render a Kanban board.

### 1.1 Parsing Grammar

- [ ] 1.1.1 Define canonical markdown grammar
- [x] 1.1.2 Document the full grammar
- [ ] 1.1.3 Create validation utility

### 1.2 Markdown Parsers

- [ ] 1.2.1 ROADMAP.md parser
- [ ] 1.2.2 Spec directory scanner

## Phase 2: Claims

**Goal**: Enable task claiming.

### 2.1 Claims Data Model

- [ ] 2.1.1 Define claims.md format
- [ ] 2.1.2 Define claim lifecycle
`;

describe('parseRoadmap', () => {
  it('parses phases correctly', () => {
    const result = parseRoadmap(SAMPLE_ROADMAP);
    expect(result.phases).toHaveLength(2);
    expect(result.phases[0].number).toBe(1);
    expect(result.phases[0].title).toBe('Read-Only Board');
    expect(result.phases[0].goal).toBe('Parse GLaDOS artifacts and render a Kanban board.');
    expect(result.phases[1].number).toBe(2);
    expect(result.phases[1].title).toBe('Claims');
  });

  it('parses sections within phases', () => {
    const result = parseRoadmap(SAMPLE_ROADMAP);
    expect(result.phases[0].sections).toHaveLength(2);
    expect(result.phases[0].sections[0].id).toBe('1.1');
    expect(result.phases[0].sections[0].title).toBe('Parsing Grammar');
    expect(result.phases[0].sections[1].id).toBe('1.2');
  });

  it('parses task items with correct IDs', () => {
    const result = parseRoadmap(SAMPLE_ROADMAP);
    const items = result.phases[0].sections[0].items;
    expect(items).toHaveLength(3);
    expect(items[0].id).toBe('1.1.1');
    expect(items[0].phase).toBe(1);
    expect(items[0].section).toBe(1);
    expect(items[0].item).toBe(1);
    expect(items[0].title).toBe('Define canonical markdown grammar');
    expect(items[0].completed).toBe(false);
  });

  it('detects completed items', () => {
    const result = parseRoadmap(SAMPLE_ROADMAP);
    const items = result.phases[0].sections[0].items;
    expect(items[1].completed).toBe(true);
    expect(items[1].id).toBe('1.1.2');
  });

  it('populates allItems as a flat list', () => {
    const result = parseRoadmap(SAMPLE_ROADMAP);
    expect(result.allItems).toHaveLength(7);
    expect(result.allItems[0].id).toBe('1.1.1');
    expect(result.allItems[6].id).toBe('2.1.2');
  });

  it('attaches section and phase titles to items', () => {
    const result = parseRoadmap(SAMPLE_ROADMAP);
    const item = result.allItems[0];
    expect(item.sectionTitle).toBe('Parsing Grammar');
    expect(item.phaseTitle).toBe('Phase 1: Read-Only Board');
  });

  it('returns empty result for empty content', () => {
    const result = parseRoadmap('');
    expect(result.phases).toHaveLength(0);
    expect(result.allItems).toHaveLength(0);
  });

  it('handles content without GLaDOS header', () => {
    const content = `# Roadmap

## Phase 1: Simple

**Goal**: Test.

### 1.1 Section

- [ ] 1.1.1 A task
`;
    const result = parseRoadmap(content);
    expect(result.allItems).toHaveLength(1);
  });

  it('handles CRLF line endings', () => {
    const content = SAMPLE_ROADMAP.replace(/\n/g, '\r\n');
    const result = parseRoadmap(content);
    expect(result.allItems).toHaveLength(7);
  });

  it('skips malformed lines gracefully', () => {
    const content = `# Roadmap

## Phase 1: Test

**Goal**: Test.

### 1.1 Section

- [ ] 1.1.1 Valid item
This is a random line that should be ignored
- [ ] 1.1.2 Another valid item
`;
    const result = parseRoadmap(content);
    expect(result.allItems).toHaveLength(2);
  });
});
