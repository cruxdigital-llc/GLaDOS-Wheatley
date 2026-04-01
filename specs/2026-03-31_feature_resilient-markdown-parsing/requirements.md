# Requirements: Resilient Markdown Parsing

## Problem Statement

Wheatley's parsers enforce a strict markdown grammar that real-world GLaDOS repos don't always follow. When markdown doesn't match exact regex patterns, data is silently dropped — the board appears empty or incomplete with no indication of why. CongaLine PR #30 required manually reformatting ~100 lines of markdown just to make it render.

## Structural Mismatches Identified

Analysis of CongaLine's pre-cleanup markdown vs. Wheatley's parser expectations:

### M1. Status parser requires numbered section headings
- **Parser**: `status-parser.ts:11` — `FOCUS_SECTION_RE = /^### (\d+)\. (.+)$/`
- **Reality**: CongaLine uses `### Backlog / Upcoming` (no number prefix)
- **Impact**: Sections without numbers are silently ignored; all tasks beneath them are lost

### M2. Status parser requires bold task labels
- **Parser**: `status-parser.ts:12` — `TASK_LINE_RE = /^- \[([ x])\] \*\*(.+?)\*\*: (.+)$/`
- **Reality**: Tasks like `- [ ] Phase 1: SSH foundation (ssh.go)` — no `**bold**` formatting
- **Impact**: All plain-text task lines are silently dropped

### M3. Status validator requires 5 specific `##` sections
- **Validator**: `validator.ts:333-341` — requires `## Project Overview`, `## Architecture`, `## Current Focus`, `## Known Issues / Technical Debt`, `## Recent Changes`
- **Reality**: CongaLine's PROJECT_STATUS.md may not have all five exact section titles
- **Impact**: Validation fails, potentially blocking board rendering or surfacing confusing errors

### M4. Roadmap tasks require `N.M.K` numeric ID prefix
- **Parser**: `roadmap-parser.ts:19` — `TASK_ITEM_RE = /^- \[([ xX])\] (\d+)\.(\d+)\.(\d+) (.+)$/`
- **Reality**: Tasks formatted as `- [x] Phase 1: SSH foundation (ssh.go)` or `- [x] Task 1: Create router` — no structured IDs
- **Impact**: All roadmap tasks without numeric IDs are silently dropped

### M5. Roadmap phase headings require exact `## Phase N: Title`
- **Parser**: `roadmap-parser.ts:16` — `PHASE_HEADING_RE = /^## Phase (\d+): (.+)$/`
- **Reality**: May use `## Phase 1 — Title` (em-dash) or other separators
- **Impact**: Phases not matching the exact pattern are ignored entirely

### M6. Roadmap section headings require `### N.M Title`
- **Parser**: `roadmap-parser.ts:18` — `SECTION_HEADING_RE = /^### (\d+)\.(\d+) (.+)$/`
- **Reality**: Sections like `### SSH Foundation` without numeric prefix
- **Impact**: Sections without IDs are ignored; tasks beneath them have no parent

### M7. Roadmap validator requires `**Goal**:` line per phase
- **Validator**: `validator.ts:83-89` — emits error if phase lacks `**Goal**:` line
- **Impact**: Validation error for phases without explicit goal lines

### M8. Status validator flags plain-text `- [` lines as errors
- **Validator**: `validator.ts:405-410` — any `- [` line in Current Focus not matching bold format is an error
- **Reality**: All of CongaLine's plain-text task lines trigger validation errors

### M9. Spec `tasks.md` phase detection (OK — already resilient)
- `validator.ts:250` uses `l.match(/^- \[([ x])\]/)` which matches any checkbox line
- No change needed

### M10. Spec directory naming (OK — already resilient)
- `spec-parser.ts:13` silently skips non-matching directories
- No change needed

## Requirements

### R1. Graceful Degradation
- Parsers MUST extract data from markdown that partially matches the expected structure
- When a strict regex fails, a looser fallback MUST be attempted before skipping the line
- Empty/missing files MUST produce empty results, never errors (already true)

### R2. Diagnostic Warnings
- Every line that could not be parsed MUST be reported as a warning (not an error)
- Warnings MUST include the file, line number, the original line content, and what format was expected
- Warnings MUST be surfaced in the API response (e.g., `boardState.warnings[]`)

### R3. No Regression on Strict Format
- Markdown that follows the strict parsing grammar MUST parse identically to today
- All existing tests MUST continue to pass
- Strict-format parsing SHOULD remain the primary path (fallbacks only when strict fails)

### R4. Success Metric
- Wheatley pointed at CongaLine's repo (pre-PR-30 state) MUST render a board with all features visible in correct phases, all PROJECT_STATUS tasks visible, and diagnostic warnings for any lines it had to use fallback parsing on
