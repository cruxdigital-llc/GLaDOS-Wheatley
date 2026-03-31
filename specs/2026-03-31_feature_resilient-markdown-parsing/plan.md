# Plan: Resilient Markdown Parsing

## Approach

Add **fallback parsing** to each parser: try the strict regex first, and when it fails, try a looser pattern that captures what it can. Generate synthetic IDs for items parsed via fallback. Surface **parse warnings** through the board state so the UI can display diagnostics.

No new dependencies. No architectural changes. The parsers remain pure functions. The type system gains a `warnings` field on `ParsedRoadmap`, `ParsedProjectStatus`, and `BoardState`.

---

## Phase 1: Add ParseWarning Type & Plumb Through Board State

**Files**:
- `src/shared/grammar/types.ts`
- `src/shared/parsers/board-assembler.ts`
- `src/server/api/board-service.ts`

**Changes**:
1. Add `ParseWarning` interface to types.ts:
   ```ts
   export interface ParseWarning {
     file: string;
     line?: number;
     message: string;
     originalLine?: string;
   }
   ```
2. Add `warnings?: ParseWarning[]` to `ParsedRoadmap`, `ParsedProjectStatus`, and `BoardState`
3. Update `assembleBoardState()` to accept and merge warnings from all parser outputs
4. Update `BoardService.getBoardState()` to pass warnings through

---

## Phase 2: Make `status-parser.ts` Resilient

**File**: `src/shared/parsers/status-parser.ts`

**Changes**:
1. **Unnumbered section headings**: Add fallback regex `FOCUS_SECTION_LOOSE_RE = /^### (.+)$/` — when the strict `### N. Title` doesn't match but `### Title` does, use the full heading text as section name
2. **Plain-text task lines**: Add fallback `TASK_LINE_LOOSE_RE = /^- \[([ x])\] (.+)$/` — when strict `**bold**: desc` doesn't match, use the full text as both label and description
3. Emit a `ParseWarning` for each line where fallback was used
4. Preserve existing behavior: strict regex is always tried first

---

## Phase 3: Make `roadmap-parser.ts` Resilient

**File**: `src/shared/parsers/roadmap-parser.ts`

**Changes**:
1. **Phase heading separator**: Broaden `PHASE_HEADING_RE` to `/^## Phase (\d+)[:—–\-] (.+)$/` — accept colon, em-dash, en-dash, or hyphen
2. **Unnumbered section headings**: Add fallback `SECTION_HEADING_LOOSE_RE = /^### (.+)$/` — generate synthetic section ID as `{currentPhase}.{autoIncrement}`
3. **Task items without IDs**: Add fallback `TASK_ITEM_LOOSE_RE = /^- \[([ xX])\] (.+)$/` — generate synthetic item ID as `{phase}.{section}.{autoIncrement}`
4. Emit `ParseWarning` for each fallback match
5. Synthetic IDs use the same `RoadmapItem` type — they just have auto-generated numeric IDs instead of author-provided ones

---

## Phase 4: Relax Validator Strictness

**File**: `src/shared/grammar/validator.ts`

**Changes**:
1. `validateProjectStatus()`: Downgrade missing `## Project Overview`, `## Architecture`, `## Recent Changes` from errors to warnings. Only `## Current Focus` remains a hard requirement
2. `validateProjectStatus()`: Accept `### Title` (unnumbered) as a valid focus section heading (downgrade from warning to acceptable)
3. `validateProjectStatus()`: Accept `- [x] plain text` task lines (downgrade from error to warning)
4. `validateRoadmap()`: Downgrade missing `**Goal**:` from error to warning
5. `validateRoadmap()`: Accept broader phase heading separator patterns
6. `validateRoadmap()`: Accept unnumbered section headings and un-IDed task items as warnings instead of errors

---

## Phase 5: Tests

**Files**:
- `src/shared/parsers/status-parser.test.ts`
- `src/shared/parsers/roadmap-parser.test.ts`
- `src/shared/parsers/board-assembler.test.ts`
- `src/shared/grammar/validator.test.ts`

**Test cases to add**:
1. **Status parser — unnumbered sections**: `### Backlog / Upcoming` without number, tasks beneath captured correctly
2. **Status parser — plain-text tasks**: `- [ ] Phase 1: SSH foundation` parsed with full text as label
3. **Status parser — mixed format**: Some tasks bold, some plain — both captured
4. **Status parser — warnings emitted**: Verify ParseWarnings generated for fallback matches
5. **Roadmap parser — em-dash separator**: `## Phase 1 — Title` parsed correctly
6. **Roadmap parser — unnumbered sections**: `### SSH Foundation` creates section with synthetic ID
7. **Roadmap parser — un-IDed tasks**: `- [x] Task 1: Create router` creates item with synthetic ID
8. **Roadmap parser — warnings emitted**: Verify ParseWarnings for fallbacks
9. **Board assembler — warnings merged**: Warnings from roadmap + status appear in BoardState
10. **Validator — relaxed sections**: Missing `## Architecture` is warning not error
11. **Validator — plain-text tasks accepted**: `- [x] text` in Current Focus is warning not error
12. **Regression**: All existing test fixtures continue to pass unchanged

---

## Phase 6: CongaLine Integration Fixture

**Files**:
- `src/shared/parsers/roadmap-parser.test.ts` (or new fixture file)
- `src/shared/parsers/status-parser.test.ts`

**Changes**:
1. Add a test fixture modeled on CongaLine's pre-PR-30 PROJECT_STATUS.md format (unnumbered backlog section, plain-text tasks, emoji in status lines)
2. Add a test fixture modeled on CongaLine's task format (no N.M.K IDs)
3. Assert that the parser extracts the expected number of tasks/items with correct phase assignments
4. Assert that warnings are emitted for each fallback match

---

## Files Summary

| File | Change Type |
|------|------------|
| `src/shared/grammar/types.ts` | Add `ParseWarning`, extend `ParsedRoadmap`, `ParsedProjectStatus`, `BoardState` |
| `src/shared/parsers/status-parser.ts` | Add fallback regexes, emit warnings |
| `src/shared/parsers/roadmap-parser.ts` | Broaden regexes, add fallbacks, emit warnings |
| `src/shared/parsers/board-assembler.ts` | Merge warnings into BoardState |
| `src/server/api/board-service.ts` | Pass warnings through |
| `src/shared/grammar/validator.ts` | Downgrade errors to warnings |
| `src/shared/parsers/status-parser.test.ts` | Add fallback + regression tests |
| `src/shared/parsers/roadmap-parser.test.ts` | Add fallback + regression tests |
| `src/shared/parsers/board-assembler.test.ts` | Add warnings merge test |
| `src/shared/grammar/validator.test.ts` | Update validation expectations |

## Verification

1. `docker compose run --rm server npx vitest run` — all tests pass
2. New test fixtures exercise every identified mismatch (M1-M8)
3. Existing strict-format tests pass unchanged (no regression)
4. Point Wheatley at CongaLine repo (pre-PR-30 commit) and visually confirm board populates correctly
