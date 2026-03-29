import { describe, it, expect } from 'vitest';
import { assembleBoardState } from './board-assembler.js';
import type {
  ParsedRoadmap,
  RoadmapPhase,
  SpecEntry,
  ParsedProjectStatus,
  ParsedClaims,
  ClaimEntry,
} from '../grammar/types.js';

/** Helper to build a ParsedRoadmap with proper phase/section structure */
function makeRoadmap(
  sections: Array<{
    sectionId: string;
    sectionTitle: string;
    items: Array<{ id: string; title: string; completed?: boolean }>;
  }>,
): ParsedRoadmap {
  const phases: RoadmapPhase[] = [];
  const allItems: ParsedRoadmap['allItems'] = [];

  for (const sec of sections) {
    const [phaseNum, sectionNum] = sec.sectionId.split('.').map(Number);

    let phase = phases.find((p) => p.number === phaseNum);
    if (!phase) {
      phase = { number: phaseNum, title: `Phase ${phaseNum}`, goal: 'Test', sections: [] };
      phases.push(phase);
    }

    const sectionItems = sec.items.map((i) => {
      const [p, s, item] = i.id.split('.').map(Number);
      return {
        id: i.id,
        phase: p,
        section: s,
        item,
        title: i.title,
        completed: i.completed ?? false,
        sectionTitle: sec.sectionTitle,
        phaseTitle: `Phase ${phaseNum}: Test`,
      };
    });

    phase.sections.push({
      id: sec.sectionId,
      title: sec.sectionTitle,
      items: sectionItems,
    });

    allItems.push(...sectionItems);
  }

  return { phases, allItems };
}

const EMPTY_STATUS: ParsedProjectStatus = { activeTasks: [], backlog: [] };
const EMPTY_CLAIMS: ParsedClaims = { entries: [], activeClaims: new Map() };

describe('assembleBoardState', () => {
  it('creates cards from roadmap items', () => {
    const roadmap = makeRoadmap([
      {
        sectionId: '1.1',
        sectionTitle: 'Section',
        items: [
          { id: '1.1.1', title: 'Define grammar' },
          { id: '1.1.2', title: 'Create validator', completed: true },
        ],
      },
    ]);
    const result = assembleBoardState(roadmap, [], EMPTY_STATUS, EMPTY_CLAIMS);

    expect(result.metadata.totalCards).toBe(2);
    expect(result.columns.find((c) => c.phase === 'unclaimed')?.cards).toHaveLength(1);
    expect(result.columns.find((c) => c.phase === 'done')?.cards).toHaveLength(1);
  });

  it('overlays spec entries on ALL items in the matched section', () => {
    const roadmap = makeRoadmap([
      {
        sectionId: '1.1',
        sectionTitle: 'Parsing Grammar',
        items: [
          { id: '1.1.1', title: 'Define grammar' },
          { id: '1.1.2', title: 'Document grammar' },
          { id: '1.1.3', title: 'Create validator' },
        ],
      },
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

    // ALL 3 items should be in implementing, not just the first
    const implCards = result.columns.find((c) => c.phase === 'implementing')?.cards;
    expect(implCards).toHaveLength(3);
    for (const card of implCards ?? []) {
      expect(card.specEntry).toBeDefined();
      expect(card.phase).toBe('implementing');
    }
  });

  it('preserves individually completed items even when section spec is not done', () => {
    const roadmap = makeRoadmap([
      {
        sectionId: '1.1',
        sectionTitle: 'Parsing Grammar',
        items: [
          { id: '1.1.1', title: 'Define grammar', completed: true },
          { id: '1.1.2', title: 'Document grammar' },
        ],
      },
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

    // Item marked [x] should stay done, even though spec is implementing
    expect(result.columns.find((c) => c.phase === 'done')?.cards).toHaveLength(1);
    expect(result.columns.find((c) => c.phase === 'implementing')?.cards).toHaveLength(1);
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
    const roadmap = makeRoadmap([
      {
        sectionId: '1.1',
        sectionTitle: 'Section',
        items: [{ id: '1.1.1', title: 'Define grammar' }],
      },
    ]);
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
      {
        sectionId: '1.1',
        sectionTitle: 'Section',
        items: [
          { id: '1.1.1', title: 'Item 1' },
          { id: '1.1.2', title: 'Item 2', completed: true },
          { id: '1.1.3', title: 'Item 3' },
        ],
      },
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

  it('cross-references status tasks by section title', () => {
    const roadmap = makeRoadmap([
      {
        sectionId: '1.1',
        sectionTitle: 'Parsing Grammar',
        items: [{ id: '1.1.1', title: 'Define grammar' }],
      },
    ]);
    const status: ParsedProjectStatus = {
      activeTasks: [
        { label: 'Parsing Grammar', description: 'In progress', completed: false, section: 'MVP' },
      ],
      backlog: [],
    };
    const result = assembleBoardState(roadmap, [], status, EMPTY_CLAIMS);

    const card = result.columns.find((c) => c.phase === 'unclaimed')?.cards[0];
    expect(card?.statusTask).toBeDefined();
    expect(card?.statusTask?.label).toBe('Parsing Grammar');
  });

  it('matches spec to section when section name contains spec name (bidirectional)', () => {
    const roadmap = makeRoadmap([
      {
        sectionId: '1.4',
        sectionTitle: 'Source Watching & Sync',
        items: [
          { id: '1.4.1', title: 'File watcher' },
          { id: '1.4.2', title: 'Poller' },
        ],
      },
    ]);
    const specs: SpecEntry[] = [
      {
        dirName: '2026-03-28_feature_source-watching',
        date: '2026-03-28',
        prefix: 'feature',
        name: 'source-watching',
        phase: 'implementing',
        files: ['README.md', 'tasks.md'],
      },
    ];
    const result = assembleBoardState(roadmap, specs, EMPTY_STATUS, EMPTY_CLAIMS);

    // "source-watching" should match "Source Watching & Sync" via bidirectional containment
    const implCards = result.columns.find((c) => c.phase === 'implementing')?.cards;
    expect(implCards).toHaveLength(2);
    for (const card of implCards ?? []) {
      expect(card.specEntry).toBeDefined();
    }
  });

  it('marks a claim as stale when the card has no spec entry and no status task', () => {
    const roadmap = makeRoadmap([
      {
        sectionId: '2.1',
        sectionTitle: 'Some Feature',
        items: [{ id: '2.1.1', title: 'Build thing' }],
      },
    ]);
    const claim: ClaimEntry = {
      status: 'claimed',
      itemId: '2.1.1',
      claimant: 'agent',
      claimedAt: '2026-03-28T10:00:00Z',
    };
    const claims: ParsedClaims = {
      entries: [claim],
      activeClaims: new Map([['2.1.1', claim]]),
    };
    // No specs and no status tasks on the viewed branch
    const result = assembleBoardState(roadmap, [], EMPTY_STATUS, claims);

    const card = result.columns.flatMap((c) => c.cards).find((c) => c.id === '2.1.1');
    expect(card?.claim).toBeDefined();
    expect(card?.stale).toBe(true);
  });

  it('does NOT mark a claim as stale when the card has a spec entry', () => {
    const roadmap = makeRoadmap([
      {
        sectionId: '2.1',
        sectionTitle: 'Some Feature',
        items: [{ id: '2.1.1', title: 'Build thing' }],
      },
    ]);
    const specs: SpecEntry[] = [
      {
        dirName: '2026-03-28_feature_some-feature',
        date: '2026-03-28',
        prefix: 'feature',
        name: 'some-feature',
        phase: 'implementing',
        files: ['README.md', 'tasks.md'],
      },
    ];
    const claim: ClaimEntry = {
      status: 'claimed',
      itemId: '2.1.1',
      claimant: 'agent',
      claimedAt: '2026-03-28T10:00:00Z',
    };
    const claims: ParsedClaims = {
      entries: [claim],
      activeClaims: new Map([['2.1.1', claim]]),
    };
    const result = assembleBoardState(roadmap, specs, EMPTY_STATUS, claims);

    const card = result.columns.flatMap((c) => c.cards).find((c) => c.id === '2.1.1');
    expect(card?.claim).toBeDefined();
    expect(card?.stale).toBeUndefined();
  });

  it('does NOT mark a claim as stale when the card has a matching status task', () => {
    const roadmap = makeRoadmap([
      {
        sectionId: '2.1',
        sectionTitle: 'Some Feature',
        items: [{ id: '2.1.1', title: 'Build thing' }],
      },
    ]);
    const claim: ClaimEntry = {
      status: 'claimed',
      itemId: '2.1.1',
      claimant: 'agent',
      claimedAt: '2026-03-28T10:00:00Z',
    };
    const claims: ParsedClaims = {
      entries: [claim],
      activeClaims: new Map([['2.1.1', claim]]),
    };
    const status: ParsedProjectStatus = {
      activeTasks: [
        { label: 'Some Feature', description: 'In progress', completed: false, section: 'Focus' },
      ],
      backlog: [],
    };
    const result = assembleBoardState(roadmap, [], status, claims);

    const card = result.columns.flatMap((c) => c.cards).find((c) => c.id === '2.1.1');
    expect(card?.claim).toBeDefined();
    expect(card?.stale).toBeUndefined();
  });

  it('does NOT set stale on unclaimed cards', () => {
    const roadmap = makeRoadmap([
      {
        sectionId: '2.1',
        sectionTitle: 'Some Feature',
        items: [{ id: '2.1.1', title: 'Build thing' }],
      },
    ]);
    const result = assembleBoardState(roadmap, [], EMPTY_STATUS, EMPTY_CLAIMS);

    const card = result.columns.flatMap((c) => c.cards).find((c) => c.id === '2.1.1');
    expect(card?.claim).toBeUndefined();
    expect(card?.stale).toBeUndefined();
  });

  it('does not false-positive match status tasks with substring overlap', () => {
    const roadmap = makeRoadmap([
      {
        sectionId: '1.1',
        sectionTitle: 'Git Adapter',
        items: [{ id: '1.1.1', title: 'Define interface' }],
      },
    ]);
    const status: ParsedProjectStatus = {
      activeTasks: [
        { label: 'Git', description: 'Unrelated task', completed: false, section: 'Other' },
      ],
      backlog: [],
    };
    const result = assembleBoardState(roadmap, [], status, EMPTY_CLAIMS);

    // "Git" should NOT match "Git Adapter" — exact match only
    const card = result.columns.find((c) => c.phase === 'unclaimed')?.cards[0];
    expect(card?.statusTask).toBeUndefined();
  });
});
