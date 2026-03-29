import { describe, it, expect } from 'vitest';
import { resolveRelationships, detectCycles, extractRelationshipsFromMetadata, buildRelationshipsFromCards } from '../resolver.js';
import type { CardRelationship } from '../types.js';

describe('resolveRelationships', () => {
  it('parent-child edges create bidirectional links', () => {
    const edges: CardRelationship[] = [
      { sourceId: '1.1.1', targetId: '1.1.0', type: 'parent' },
    ];

    const map = resolveRelationships(edges);

    // Source gets parent set
    expect(map.get('1.1.1')?.parent).toBe('1.1.0');
    // Target gets child added
    expect(map.get('1.1.0')?.children).toContain('1.1.1');
  });

  it('blocks/blocked-by edges create bidirectional links', () => {
    const edges: CardRelationship[] = [
      { sourceId: '1.1.1', targetId: '1.1.2', type: 'blocks' },
    ];

    const map = resolveRelationships(edges);

    // Source blocks target
    expect(map.get('1.1.1')?.blocks).toContain('1.1.2');
    // Target is blocked by source
    expect(map.get('1.1.2')?.blockedBy).toContain('1.1.1');
  });
});

describe('detectCycles', () => {
  it('returns empty array for acyclic graph', () => {
    const edges: CardRelationship[] = [
      { sourceId: '1.1.1', targetId: '1.1.2', type: 'blocks' },
      { sourceId: '1.1.2', targetId: '1.1.3', type: 'blocks' },
    ];

    const map = resolveRelationships(edges);
    const cycles = detectCycles(map);

    expect(cycles).toEqual([]);
  });

  it('detects simple A->B->A cycle', () => {
    const edges: CardRelationship[] = [
      { sourceId: '1.1.1', targetId: '1.1.2', type: 'blocks' },
      { sourceId: '1.1.2', targetId: '1.1.1', type: 'blocks' },
    ];

    const map = resolveRelationships(edges);
    const cycles = detectCycles(map);

    expect(cycles.length).toBeGreaterThan(0);
    expect(cycles).toContain('1.1.1');
    expect(cycles).toContain('1.1.2');
  });

  it('detects longer A->B->C->A cycle', () => {
    const edges: CardRelationship[] = [
      { sourceId: '1.1.1', targetId: '1.1.2', type: 'blocks' },
      { sourceId: '1.1.2', targetId: '1.1.3', type: 'blocks' },
      { sourceId: '1.1.3', targetId: '1.1.1', type: 'blocks' },
    ];

    const map = resolveRelationships(edges);
    const cycles = detectCycles(map);

    expect(cycles.length).toBeGreaterThan(0);
    expect(cycles).toContain('1.1.1');
    expect(cycles).toContain('1.1.2');
    expect(cycles).toContain('1.1.3');
  });
});

describe('extractRelationshipsFromMetadata', () => {
  it('extracts all relationship types from metadata', () => {
    const metadata = {
      parent: '1.0.0',
      children: ['1.1.2', '1.1.3'],
      blocks: ['2.1.1'],
      blockedBy: ['3.1.1'],
    };

    const edges = extractRelationshipsFromMetadata('1.1.1', metadata);

    expect(edges).toHaveLength(5);
    expect(edges).toContainEqual({ sourceId: '1.1.1', targetId: '1.0.0', type: 'parent' });
    expect(edges).toContainEqual({ sourceId: '1.1.1', targetId: '1.1.2', type: 'child' });
    expect(edges).toContainEqual({ sourceId: '1.1.1', targetId: '1.1.3', type: 'child' });
    expect(edges).toContainEqual({ sourceId: '1.1.1', targetId: '2.1.1', type: 'blocks' });
    expect(edges).toContainEqual({ sourceId: '1.1.1', targetId: '3.1.1', type: 'blocked-by' });
  });

  it('returns empty array for undefined metadata', () => {
    const edges = extractRelationshipsFromMetadata('1.1.1', undefined);
    expect(edges).toEqual([]);
  });
});

describe('buildRelationshipsFromCards', () => {
  it('aggregates relationships across multiple cards', () => {
    const cards = [
      {
        id: '1.1.1',
        metadata: { children: ['1.1.2'], blocks: ['2.1.1'] },
      },
      {
        id: '1.1.2',
        metadata: { parent: '1.1.1' },
      },
      {
        id: '2.1.1',
        metadata: { blockedBy: ['1.1.1'] },
      },
    ];

    const map = buildRelationshipsFromCards(cards);

    // 1.1.1 should have child 1.1.2 and block 2.1.1
    const rel1 = map.get('1.1.1');
    expect(rel1?.children).toContain('1.1.2');
    expect(rel1?.blocks).toContain('2.1.1');

    // 1.1.2 should have parent 1.1.1
    const rel2 = map.get('1.1.2');
    expect(rel2?.parent).toBe('1.1.1');

    // 2.1.1 should be blocked by 1.1.1
    const rel3 = map.get('2.1.1');
    expect(rel3?.blockedBy).toContain('1.1.1');
  });
});
