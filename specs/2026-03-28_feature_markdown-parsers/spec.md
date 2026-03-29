# Spec: Markdown Parsers

## 1. Parser API

```typescript
// Roadmap parser
function parseRoadmap(content: string): ParsedRoadmap;

// Spec directory parser
interface SpecDirectoryInput {
  dirName: string;
  files: string[];
  tasksContent?: string;   // For verifying/done detection
  readmeContent?: string;  // For done detection
}
function parseSpecDirectories(dirs: SpecDirectoryInput[]): SpecEntry[];

// Status parser
function parseProjectStatus(content: string): ParsedProjectStatus;

// Claims parser
function parseClaims(content: string): ParsedClaims;

// Board assembler
function assembleBoardState(
  roadmap: ParsedRoadmap,
  specs: SpecEntry[],
  status: ParsedProjectStatus,
  claims: ParsedClaims,
): BoardState;
```

## 2. Board State Model

```typescript
interface BoardCard {
  id: string;             // Roadmap item ID or spec dir name
  title: string;
  phase: BoardPhase;
  source: 'roadmap' | 'spec' | 'status';
  roadmapItem?: RoadmapItem;
  specEntry?: SpecEntry;
  statusTask?: StatusTask;
  claim?: ClaimEntry;
}

interface BoardColumn {
  phase: BoardPhase;
  title: string;          // Display name for the column
  cards: BoardCard[];
}

interface BoardState {
  columns: BoardColumn[];
  metadata: {
    totalCards: number;
    claimedCount: number;
    completedCount: number;
  };
}
```

## 3. Cross-Referencing Logic

Cards are assembled by merging data from multiple sources:
1. Start with roadmap items as the base set of cards
2. For each spec directory, match to a roadmap item by name similarity or explicit reference
3. Override the phase based on spec directory detection (spec phase is more accurate than roadmap checkbox)
4. Attach claims from claims.md by item ID
5. Active tasks from PROJECT_STATUS.md provide supplementary metadata (lead, description)

## 4. Edge Cases
- Roadmap item with no matching spec → card in "unclaimed" column
- Spec directory with no matching roadmap item → card created from spec (source: 'spec')
- Multiple specs matching the same roadmap item → warn, use the latest by date
- Empty roadmap → empty board (not an error)
- Malformed lines → skip with warning, don't fail the entire parse
