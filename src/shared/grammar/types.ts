/**
 * Wheatley Parsing Grammar — TypeScript Types
 *
 * These types define the shared contract for all parsed GLaDOS artifacts.
 * See: product-knowledge/standards/parsing-grammar.md
 */

// Board phases matching GLaDOS workflow
export type BoardPhase =
  | 'unclaimed'
  | 'planning'
  | 'speccing'
  | 'implementing'
  | 'verifying'
  | 'done';

// Ordered phases for comparison
export const PHASE_ORDER: readonly BoardPhase[] = [
  'unclaimed',
  'planning',
  'speccing',
  'implementing',
  'verifying',
  'done',
] as const;

// --- ROADMAP.md types ---

export interface RoadmapItem {
  /** Full item ID, e.g., "1.1.1" */
  id: string;
  /** Phase number, e.g., 1 */
  phase: number;
  /** Section number within the phase, e.g., 1 */
  section: number;
  /** Item number within the section, e.g., 1 */
  item: number;
  /** The text after the item ID */
  title: string;
  /** Whether the checkbox is [x] */
  completed: boolean;
  /** Parent section title, e.g., "Parsing Grammar & Contract" */
  sectionTitle: string;
  /** Parent phase title, e.g., "Phase 1: Read-Only Board" */
  phaseTitle: string;
}

export interface RoadmapPhase {
  /** Phase number */
  number: number;
  /** Phase title, e.g., "Read-Only Board" */
  title: string;
  /** Phase goal */
  goal: string;
  /** Sections within the phase */
  sections: RoadmapSection[];
}

export interface RoadmapSection {
  /** Section ID, e.g., "1.1" */
  id: string;
  /** Section title */
  title: string;
  /** Items within the section */
  items: RoadmapItem[];
}

export interface ParsedRoadmap {
  phases: RoadmapPhase[];
  /** Flat list of all items across all phases */
  allItems: RoadmapItem[];
}

// --- specs/ directory types ---

export interface SpecEntry {
  /** Full directory name, e.g., "2026-03-28_feature_parsing-grammar" */
  dirName: string;
  /** Date from directory name, e.g., "2026-03-28" */
  date: string;
  /** Prefix, e.g., "feature" */
  prefix: string;
  /** Kebab-case name, e.g., "parsing-grammar" */
  name: string;
  /** Detected phase based on files present */
  phase: BoardPhase;
  /** Files found in the directory */
  files: string[];
}

// --- PROJECT_STATUS.md types ---

export interface StatusTask {
  /** Bold label, e.g., "Repo parser" */
  label: string;
  /** Text after the label */
  description: string;
  /** Whether the checkbox is [x] */
  completed: boolean;
  /** Which focus section it's under */
  section: string;
  /** Lead if specified */
  lead?: string;
}

export interface ParsedProjectStatus {
  /** Active tasks from focus sections */
  activeTasks: StatusTask[];
  /** Backlog items */
  backlog: StatusTask[];
}

// --- claims.md types ---

export type ClaimStatus = 'claimed' | 'released' | 'expired';

export interface ClaimEntry {
  /** Roadmap item ID, e.g., "1.1.1" */
  itemId: string;
  /** Who claimed it */
  claimant: string;
  /** ISO 8601 timestamp when claimed */
  claimedAt: string;
  /** ISO 8601 timestamp when released/expired (if applicable) */
  releasedAt?: string;
  /** Current status */
  status: ClaimStatus;
}

export interface ParsedClaims {
  /** All claim entries (chronological) */
  entries: ClaimEntry[];
  /** Active claims only (last entry per item where status = 'claimed') */
  activeClaims: Map<string, ClaimEntry>;
}

// --- Board state types (assembled from all parsers) ---

export type CardSource = 'roadmap' | 'spec' | 'status';

export interface BoardCard {
  /** Unique card ID — roadmap item ID or spec dir name */
  id: string;
  /** Display title */
  title: string;
  /** Current phase */
  phase: BoardPhase;
  /** Where this card's data originates */
  source: CardSource;
  /** Linked roadmap item (if any) */
  roadmapItem?: RoadmapItem;
  /** Linked spec entry (if any) */
  specEntry?: SpecEntry;
  /** Linked status task (if any) */
  statusTask?: StatusTask;
  /** Active claim on this item (if any) */
  claim?: ClaimEntry;
}

export interface BoardColumn {
  /** Phase this column represents */
  phase: BoardPhase;
  /** Display name for the column */
  title: string;
  /** Cards in this column */
  cards: BoardCard[];
}

export interface BoardState {
  /** Columns in phase order */
  columns: BoardColumn[];
  /** Summary metadata */
  metadata: {
    totalCards: number;
    claimedCount: number;
    completedCount: number;
  };
}

// --- Validation types ---

export interface ValidationError {
  /** Which file the error is in */
  file: string;
  /** Line number (1-indexed) if applicable */
  line?: number;
  /** Human-readable error message */
  message: string;
  /** Which grammar rule was violated */
  rule: string;
}

export interface ValidationWarning {
  /** Which file the warning is in */
  file: string;
  /** Line number (1-indexed) if applicable */
  line?: number;
  /** Human-readable warning message */
  message: string;
  /** Suggested fix */
  suggestion: string;
}

export interface ValidationResult {
  /** Whether the artifact conforms to the grammar */
  valid: boolean;
  /** Errors that must be fixed */
  errors: ValidationError[];
  /** Warnings that should be reviewed */
  warnings: ValidationWarning[];
}
