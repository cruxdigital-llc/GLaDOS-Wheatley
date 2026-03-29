import { describe, it, expect } from 'vitest';
import { assembleBoardState } from './board-assembler.js';
import type {
  ParsedRoadmap,
  SpecEntry,
  ParsedProjectStatus,
  ParsedClaims,
  ClaimEntry,
} from '../grammar/types.js';

function makeRoadmap(items: Array<{ id: string; title: string; completed?: boolean; sectionTitle?: string }>): ParsedRoadmap {
  return {
    phases: [],
    allItems: items.map((i) => ({
      id: i.id,
      phase: parseInt(i.id.split('.')[0], 10),
      section: parseInt(i.id.split('.')[1], 10),
      item: parseInt(i.id.split('.')[2], 10),
      title: i.title,
      completed: i.completed ?? false,
      sectionTitle: i.sectionTitle ?? 'Section',
      phaseTitle: 'Phase 1: Test',
    })),
  };
}

const EMPTY_STATUS: ParsedProjectStatus = { activeTasks: [], backlog: [] };
const EMPTY_CLAIMS: ParsedClaims = { entries: [], activeClaims: new Map() };

describe('assembleBoardState', () => {
  it('creates cards from roadmap items', () => {
    const roadmap = makeRoadmap([
      { id: '1.1.1', title: 'Define grammar' },
      { id: '1.1.2', title: 'Create validator', completed: true },
    ]);
    const result = assembleBoardState(roadmap, [], EMPTY_STATUS, EMPTY_CLAIMS);

    expect(result.metadata.totalCards).toBe(2);
    expect(result.columns.find((c) => c.phase === 'unclaimed')?.cards).toHaveLength(1);
    expect(result.columns.find((c) => c.phase === 'done')?.cards).toHaveLength(1);
  });

  it('overlays spec entries with better phase info', () => {
    const roadmap = makeRoadmap([
      { id: '1.1.1', title: 'Define grammar', sectionTitle: 'Parsing Grammar' },
    ]);
    const specs: SpecEntry[] = [
      {
        dirName: '2026-03-28_feature_parsing-grammar',
        date: '2026-03-28',
        prefix: 'feature',
        name: 'parsing-grammar',
        phase: 'implementing',
        files: ['README.md', 'spec.md', 'tasks.md'],
      },
    ];
    const result = assembleBoardState(roadmap, specs, EMPTY_STATUS, EMPTY_CLAIMS);

    // The card should be in implementing (from spec) not unclaimed (from roadmap)
    const implCards = result.columns.find((c) => c.phase === 'implementing')?.cards;
    expect(implCards).toHaveLength(1);
    expect(implCards?.[0].specEntry).toBeDefined();
  });

  it('creates cards from unmatched spec entries', () => {
    const roadmap = makeRoadmap([]);
    const specs: SpecEntry[] = [
      {
        dirName: '2026-03-28_feature_orphan-feature',
        date: '2026-03-28',
        prefix: 'feature',
        name: 'orphan-feature',
        phase: 'planning',
        files: ['README.md', 'plan.md'],
      },
    ];
    const result = assembleBoardState(roadmap, specs, EMPTY_STATUS, EMPTY_CLAIMS);

    expect(result.metadata.totalCards).toBe(1);
    const planCards = result.columns.find((c) => c.phase === 'planning')?.cards;
    expect(planCards).toHaveLength(1);
    expect(planCards?.[0].source).toBe('spec');
    expect(planCards?.[0].title).toBe('orphan feature');
  });

  it('attaches claims to matching cards', () => {
    const roadmap = makeRoadmap([{ id: '1.1.1', title: 'Define grammar' }]);
    const claim: ClaimEntry = {
      status: 'claimed',
      itemId: '1.1.1',
      claimant: 'jed2nd',
      claimedAt: '2026-03-28T20:00:00Z',
    };
    const claims: ParsedClaims = {
      entries: [claim],
      activeClaims: new Map([['1.1.1', claim]]),
    };
    const result = assembleBoardState(roadmap, [], EMPTY_STATUS, claims);

    const card = result.columns.find((c) => c.phase === 'unclaimed')?.cards[0];
    expect(card?.claim).toBeDefined();
    expect(card?.claim?.claimant).toBe('jed2nd');
    expect(result.metadata.claimedCount).toBe(1);
  });

  it('skips non-feature spec prefixes', () => {
    const roadmap = makeRoadmap([]);
    const specs: SpecEntry[] = [
      {
        dirName: '2026-03-28_mission-statement_initial',
        date: '2026-03-28',
        prefix: 'mission-statement',
        name: 'initial',
        phase: 'unclaimed',
        files: ['README.md'],
      },
    ];
    const result = assembleBoardState(roadmap, specs, EMPTY_STATUS, EMPTY_CLAIMS);
    expect(result.metadata.totalCards).toBe(0);
  });

  it('returns all 6 columns in phase order', () => {
    const roadmap = makeRoadmap([]);
    const result = assembleBoardState(roadmap, [], EMPTY_STATUS, EMPTY_CLAIMS);

    expect(result.columns).toHaveLength(6);
    expect(result.columns[0].phase).toBe('unclaimed');
    expect(result.columns[1].phase).toBe('planning');
    expect(result.columns[2].phase).toBe('speccing');
    expect(result.columns[3].phase).toBe('implementing');
    expect(result.columns[4].phase).toBe('verifying');
    expect(result.columns[5].phase).toBe('done');
  });

  it('handles empty inputs', () => {
    const roadmap: ParsedRoadmap = { phases: [], allItems: [] };
    const result = assembleBoardState(roadmap, [], EMPTY_STATUS, EMPTY_CLAIMS);
    expect(result.metadata.totalCards).toBe(0);
    expect(result.columns).toHaveLength(6);
  });

  it('computes metadata correctly', () => {
    const roadmap = makeRoadmap([
      { id: '1.1.1', title: 'Item 1' },
      { id: '1.1.2', title: 'Item 2', completed: true },
      { id: '1.1.3', title: 'Item 3' },
    ]);
    const claim: ClaimEntry = {
      status: 'claimed',
      itemId: '1.1.1',
      claimant: 'someone',
      claimedAt: '2026-03-28T20:00:00Z',
    };
    const claims: ParsedClaims = {
      entries: [claim],
      activeClaims: new Map([['1.1.1', claim]]),
    };
    const result = assembleBoardState(roadmap, [], EMPTY_STATUS, claims);

    expect(result.metadata.totalCards).toBe(3);
    expect(result.metadata.claimedCount).toBe(1);
    expect(result.metadata.completedCount).toBe(1);
  });
});
