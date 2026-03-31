# Spec: Parsing Grammar & Project Scaffold

## 1. Project Structure

```
src/
├── shared/
│   └── grammar/
│       ├── types.ts          # All TypeScript types for parsed GLaDOS artifacts
│       ├── validator.ts      # Validation functions
│       └── validator.test.ts # Tests
├── server/
│   └── index.ts              # Placeholder entry point
└── client/
    └── (empty, placeholder for feature 1.6)
```

## 2. Parsing Grammar Specification

### 2.1 ROADMAP.md Grammar

```
ROADMAP      := HEADER PHASE+
HEADER       := HTML_COMMENT BLANK_LINE "# Roadmap" BLANK_LINE
PHASE        := "## " PHASE_TITLE BLANK_LINE GOAL BLANK_LINE SECTION+
PHASE_TITLE  := "Phase " NUMBER ": " TEXT
GOAL         := "**Goal**: " TEXT
SECTION      := "### " SECTION_ID " " TEXT BLANK_LINE TASK_ITEM+
SECTION_ID   := NUMBER "." NUMBER
TASK_ITEM    := "- [" STATUS "] " ITEM_ID " " TEXT NEWLINE
STATUS       := " " | "x"
ITEM_ID      := NUMBER "." NUMBER "." NUMBER
```

Rules:
- Phases are numbered sequentially starting from 1
- Sections are numbered as `PHASE.SECTION` (e.g., `1.1`, `1.2`)
- Task items are numbered as `PHASE.SECTION.ITEM` (e.g., `1.1.1`, `1.1.2`)
- Status `" "` = unclaimed/incomplete, `"x"` = complete
- A task item with `[x]` is considered Done

### 2.2 specs/ Directory Grammar

```
SPEC_DIR     := "specs/" DATE "_" PREFIX "_" KEBAB_NAME "/"
DATE         := YYYY "-" MM "-" DD
PREFIX       := "feature" | "fix" | "mission-statement" | "plan-product"
KEBAB_NAME   := [a-z0-9]+("-"[a-z0-9]+)*
```

Required files and phase detection:

| File | Purpose |
|---|---|
| `README.md` | Trace log (always present) |
| `requirements.md` | Requirements (present from Planning) |
| `plan.md` | High-level plan (present from Planning) |
| `spec.md` | Technical specification (present from Speccing) |
| `tasks.md` | Implementation checklist (present from Implementing) |

Phase detection rules (ordered, first match wins):
1. If `tasks.md` exists AND all tasks checked → **Verifying** (or **Done** if verify log in README)
2. If `tasks.md` exists → **Implementing**
3. If `spec.md` exists → **Speccing**
4. If `plan.md` exists → **Planning**
5. If only `README.md` exists → **Unclaimed** (trace started but no work)

### 2.3 PROJECT_STATUS.md Grammar

```
STATUS_DOC   := HEADER OVERVIEW ARCHITECTURE FOCUS BACKLOG ISSUES CHANGES
OVERVIEW     := "## Project Overview" BLANK_LINE FIELD+ BLANK_LINE TEXT
FOCUS        := "## Current Focus" BLANK_LINE FOCUS_SECTION+
FOCUS_SECTION:= "### " NUMBER ". " TEXT BLANK_LINE LEAD? TASK_LINE+
LEAD         := "*Lead: " TEXT "*" NEWLINE
TASK_LINE    := "- [" STATUS "] **" LABEL "**: " TEXT NEWLINE
BACKLOG      := "### " NUMBER ". Backlog / Upcoming" BLANK_LINE TASK_LINE+
ISSUES       := "## Known Issues / Technical Debt" BLANK_LINE (TEXT | TASK_LINE)+
CHANGES      := "## Recent Changes" BLANK_LINE CHANGE_LINE+
CHANGE_LINE  := "- " DATE ": " TEXT NEWLINE
```

### 2.4 claims.md Grammar (Phase 2 readiness, read-only in Phase 1)

```
CLAIMS_DOC   := HEADER "# Claims" BLANK_LINE CLAIM_ENTRY*
CLAIM_ENTRY  := "- [" CLAIM_STATUS "] " ITEM_ID " | " CLAIMANT " | " TIMESTAMP (" | " RELEASE_TS)? NEWLINE
CLAIM_STATUS := "claimed" | "released" | "expired"
CLAIMANT     := TEXT (git identity or display name)
TIMESTAMP    := ISO_8601_DATETIME
RELEASE_TS   := ISO_8601_DATETIME
```

## 3. TypeScript Types

```typescript
// Board phases matching GLaDOS workflow
type BoardPhase = 'unclaimed' | 'planning' | 'speccing' | 'implementing' | 'verifying' | 'done';

// A single roadmap task item
interface RoadmapItem {
  id: string;          // e.g., "1.1.1"
  phase: number;       // e.g., 1
  section: number;     // e.g., 1
  item: number;        // e.g., 1
  title: string;       // The text after the item ID
  completed: boolean;  // [x] or [ ]
  sectionTitle: string; // e.g., "Parsing Grammar & Contract"
  phaseTitle: string;  // e.g., "Phase 1: Read-Only Board"
}

// A spec directory
interface SpecEntry {
  dirName: string;     // e.g., "2026-03-28_feature_parsing-grammar"
  date: string;        // e.g., "2026-03-28"
  prefix: string;      // e.g., "feature"
  name: string;        // e.g., "parsing-grammar"
  phase: BoardPhase;   // Detected from files present
  files: string[];     // Files found in the directory
}

// An active task from PROJECT_STATUS.md
interface StatusTask {
  label: string;       // Bold label, e.g., "Repo parser"
  description: string; // Text after the label
  completed: boolean;
  section: string;     // Which focus section it's under
  lead?: string;       // Lead if specified
}

// A claim entry
interface ClaimEntry {
  itemId: string;       // Roadmap item ID
  claimant: string;
  claimedAt: string;    // ISO 8601
  releasedAt?: string;  // ISO 8601
  status: 'claimed' | 'released' | 'expired';
}

// Validation result
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

interface ValidationError {
  file: string;
  line?: number;
  message: string;
  rule: string;       // Which grammar rule was violated
}

interface ValidationWarning {
  file: string;
  line?: number;
  message: string;
  suggestion: string;
}
```

## 4. Validation Utility API

```typescript
// Validate a ROADMAP.md file content
function validateRoadmap(content: string): ValidationResult;

// Validate a specs/ directory listing
function validateSpecDirectory(dirName: string, files: string[]): ValidationResult;

// Validate a PROJECT_STATUS.md file content
function validateProjectStatus(content: string): ValidationResult;

// Validate a claims.md file content
function validateClaims(content: string): ValidationResult;
```

## 5. Edge Cases

- Empty file → ValidationError
- Missing required sections → ValidationError with specific section name
- Malformed checkbox (e.g., `- [] ` instead of `- [ ] `) → ValidationError
- Unnumbered items → ValidationError
- Out-of-sequence numbering → ValidationWarning
- Extra sections not in the grammar → ValidationWarning (not an error, extensible)
- Windows line endings (CRLF) → handled transparently
- Trailing whitespace → handled transparently
