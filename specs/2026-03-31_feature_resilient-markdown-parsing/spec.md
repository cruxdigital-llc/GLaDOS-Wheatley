# Specification: Resilient Markdown Parsing

## Overview

This feature adds fallback parsing to Wheatley's markdown parsers so that imperfectly-structured GLaDOS repos still render usable board state. The strict grammar remains the primary parsing path; fallbacks activate only when strict patterns don't match. All fallback activations produce diagnostic warnings surfaced through the API.

---

## 1. Data Model Changes

### 1.1 New Type: `ParseWarning`

**File**: `src/shared/grammar/types.ts`

```ts
export interface ParseWarning {
  /** Source file (e.g., "ROADMAP.md", "PROJECT_STATUS.md") */
  file: string;
  /** 1-indexed line number where the fallback was triggered */
  line?: number;
  /** What the parser expected vs. what it found */
  message: string;
  /** The original line content that triggered the fallback */
  originalLine?: string;
}
```

### 1.2 Extended Return Types

Add `warnings?: ParseWarning[]` to:
- `ParsedRoadmap` — warnings from roadmap parsing
- `ParsedProjectStatus` — warnings from status parsing
- `BoardState` — merged warnings from all parsers

The `warnings` field is optional and defaults to `undefined` (not empty array) when no fallbacks were triggered, preserving backward compatibility for all consumers that destructure `BoardState`.

### 1.3 No Database / Schema Changes

All data remains in markdown files. No new files are created or consumed. The only change is additional fields in in-memory types and API responses.

---

## 2. Parser Changes

### 2.1 `status-parser.ts` — Flexible Section Headings & Task Lines

**Current strict patterns:**
```
FOCUS_SECTION_RE = /^### (\d+)\. (.+)$/
TASK_LINE_RE     = /^- \[([ x])\] \*\*(.+?)\*\*: (.+)$/
```

**New fallback patterns:**
```
FOCUS_SECTION_LOOSE_RE = /^### (.+)$/
TASK_LINE_LOOSE_RE     = /^- \[([ xX])\] (.+)$/
```

**Logic change** (in the `for` loop over lines):

```
// Section heading — try strict first, then loose
const sectionMatch = trimmed.match(FOCUS_SECTION_RE);
if (sectionMatch) {
  currentSection = sectionMatch[2];
  // ... existing logic
  continue;
}
// Fallback: unnumbered heading
if (!sectionMatch && trimmed.startsWith('### ')) {
  const looseMatch = trimmed.match(FOCUS_SECTION_LOOSE_RE);
  if (looseMatch) {
    currentSection = looseMatch[1];
    isBacklog = /backlog/i.test(currentSection);
    currentLead = undefined;
    warnings.push({ file: 'PROJECT_STATUS.md', line: lineIndex+1,
      message: 'Section heading lacks "### N. Title" numbering — parsed with fallback',
      originalLine: trimmed });
    continue;
  }
}

// Task line — try strict first, then loose
const taskMatch = trimmed.match(TASK_LINE_RE);
if (taskMatch) {
  // ... existing logic (unchanged)
} else if (trimmed.match(/^- \[([ xX])\]/)) {
  const looseMatch = trimmed.match(TASK_LINE_LOOSE_RE);
  if (looseMatch) {
    const fullText = looseMatch[2];
    // Try to extract a "Label: Description" pattern from plain text
    const colonSplit = fullText.match(/^(.+?):\s+(.+)$/);
    const label = colonSplit ? colonSplit[1] : fullText;
    const description = colonSplit ? colonSplit[2] : fullText;
    const task = {
      label, description,
      completed: looseMatch[1].toLowerCase() === 'x',
      section: currentSection,
      lead: currentLead,
    };
    // Route to active or backlog
    if (isBacklog) backlog.push(task);
    else activeTasks.push(task);
    warnings.push({ file: 'PROJECT_STATUS.md', line: lineIndex+1,
      message: 'Task line lacks "**Label**: Description" format — parsed with fallback',
      originalLine: trimmed });
  }
}
```

**Key decisions:**
- For plain-text task lines, attempt to split on `:` to extract label/description. If no colon exists, use the full text for both fields.
- `[X]` (uppercase) is accepted as completed in the loose pattern (already accepted in roadmap parser).
- The `section` field defaults to empty string if no section heading has been seen yet, preserving the existing behavior for tasks above the first heading.

### 2.2 `roadmap-parser.ts` — Flexible Phases, Sections & Tasks

**Current strict patterns:**
```
PHASE_HEADING_RE   = /^## Phase (\d+): (.+)$/
SECTION_HEADING_RE = /^### (\d+)\.(\d+) (.+)$/
TASK_ITEM_RE       = /^- \[([ xX])\] (\d+)\.(\d+)\.(\d+) (.+)$/
```

**New patterns:**
```
// Broadened strict: accept colon, em-dash, en-dash, or hyphen as separator
PHASE_HEADING_RE   = /^## Phase (\d+)\s*[:—–\-]\s*(.+)$/

// Fallback patterns
SECTION_HEADING_LOOSE_RE = /^### (.+)$/
TASK_ITEM_LOOSE_RE       = /^- \[([ xX])\] (.+)$/
```

**Synthetic ID generation:**

When a section heading lacks a numeric ID, generate `{currentPhaseNum}.{autoSectionCounter}`:
```ts
let autoSectionCounter = 0;  // reset to 0 at each new phase

// On loose section match:
autoSectionCounter++;
const syntheticId = `${currentPhase.number}.${autoSectionCounter}`;
currentSection = { id: syntheticId, title: looseMatch[1], items: [] };
```

When a task item lacks a numeric ID, generate `{phase}.{section}.{autoItemCounter}`:
```ts
let autoItemCounter = 0;  // reset to 0 at each new section

// On loose task match:
autoItemCounter++;
const syntheticId = `${currentPhase.number}.${currentSectionNum}.${autoItemCounter}`;
```

**Key decisions:**
- Synthetic IDs use the same numeric format as real IDs so downstream code (board assembler, claims matching) works without changes.
- The `PHASE_HEADING_RE` broadening is a strict regex change (not a fallback) since it's universally safe — no existing content uses `## Phase 1 — Title` to mean something other than a phase heading.
- The loose `### (.+)$` fallback only activates when `currentPhase` exists (we're inside a phase). Stray `###` headings before any `## Phase` are ignored.
- The loose `- [([ xX])] (.+)$` fallback only activates when both `currentPhase` and `currentSection` exist.

### 2.3 `board-assembler.ts` — Merge Warnings

**Current signature:**
```ts
export function assembleBoardState(
  roadmap: ParsedRoadmap,
  specs: SpecEntry[],
  status: ParsedProjectStatus,
  claims: ParsedClaims,
): BoardState
```

**New signature:**
```ts
export function assembleBoardState(
  roadmap: ParsedRoadmap,
  specs: SpecEntry[],
  status: ParsedProjectStatus,
  claims: ParsedClaims,
): BoardState
```

Signature stays the same. The function reads `roadmap.warnings` and `status.warnings` from the parsed inputs and merges them onto the returned `BoardState.warnings`:

```ts
const warnings = [
  ...(roadmap.warnings ?? []),
  ...(status.warnings ?? []),
];
return { columns, metadata, ...(warnings.length > 0 ? { warnings } : {}) };
```

### 2.4 `board-service.ts` — No Changes Needed

`BoardService.getBoardState()` already returns the `BoardState` object directly. Since `warnings` is a new optional field on `BoardState`, it flows through automatically. No code changes required.

---

## 3. Validator Changes

### 3.1 `validateProjectStatus()` — Relaxed Sections

**File**: `src/shared/grammar/validator.ts`

**Changes:**

1. Split `requiredSections` into hard requirements and soft requirements:
   ```ts
   const hardRequired = ['## Current Focus'];
   const softRequired = [
     '## Project Overview',
     '## Architecture',
     '## Known Issues / Technical Debt',
     '## Recent Changes',
   ];
   ```
   - Missing hard requirements → error
   - Missing soft requirements → warning

2. Accept `### Title` (unnumbered) as a valid focus section heading — produce a warning instead of the current warning about format mismatch.

3. Accept `- [x] plain text` task lines in Current Focus — downgrade from error to warning:
   ```ts
   // Current: error for any - [ line not matching bold format
   // New: warning suggesting the bold format
   if (line.startsWith('- [')) {
     if (!TASK_LINE_RE.test(line)) {
       if (/^- \[([ xX])\] .+$/.test(line)) {
         warnings.push({ file, line: lineNum,
           message: `Task line uses plain text format: "${line}"`,
           suggestion: 'Use format: - [ ] **Label**: Description' });
       } else {
         errors.push({ ... }); // truly malformed — still an error
       }
     }
   }
   ```

### 3.2 `validateRoadmap()` — Relaxed Goals & Formats

1. Downgrade missing `**Goal**:` from error to warning
2. Broaden `PHASE_HEADING_RE` to accept multiple separator styles (same regex as parser)
3. Accept unnumbered `### Title` section headings as warnings (not errors)
4. Accept un-IDed `- [x] Title` task items as warnings (not errors)

---

## 4. API Interface

### 4.1 `GET /api/board` — Response Extension

The existing `BoardState` response gains an optional `warnings` field:

```json
{
  "columns": [...],
  "metadata": { "totalCards": 42, "claimedCount": 3, "completedCount": 30 },
  "warnings": [
    {
      "file": "ROADMAP.md",
      "line": 15,
      "message": "Section heading lacks N.M numbering — parsed with fallback",
      "originalLine": "### SSH Foundation"
    },
    {
      "file": "PROJECT_STATUS.md",
      "line": 28,
      "message": "Task line lacks **Label**: Description format — parsed with fallback",
      "originalLine": "- [x] Phase 1: SSH foundation (ssh.go)"
    }
  ]
}
```

When no fallbacks were triggered, `warnings` is either absent or an empty array.

### 4.2 `GET /api/conformance` — No Changes

The conformance analyzer already uses the validator. The validator changes (error→warning downgrades) will automatically reflect in conformance reports. No additional changes needed.

---

## 5. Edge Cases

### 5.1 Ambiguous `### ` Lines
A `### ` line inside Current Focus that isn't a section heading (e.g., `### Note about something`) would be incorrectly treated as a section heading by the loose fallback.

**Mitigation**: Only match `### (.+)$` when we're inside `## Current Focus`. Outside Current Focus, `### ` lines are already ignored.

### 5.2 Colliding Synthetic IDs
If a ROADMAP.md has a mix of numbered and unnumbered sections, synthetic IDs could collide with real IDs.

**Mitigation**: Track the highest real section number seen in the current phase. Start the synthetic counter from `max(realSectionNum) + 1` when generating fallback IDs. Same approach for item IDs within sections.

### 5.3 Task Lines That Look Like Checkboxes But Aren't
Lines like `- [link text](url)` start with `- [` but aren't checkboxes.

**Mitigation**: The loose regex `- \[([ xX])\]` requires exactly one character (space, x, or X) inside brackets followed by `]`. `- [link text]` has multiple characters and won't match.

### 5.4 Uppercase `[X]` Handling
The strict roadmap regex already accepts `[X]` via `[ xX]`. The status parser strict regex only accepts `[ x]`.

**Mitigation**: The loose fallback for status parser uses `[ xX]` to also accept uppercase. The strict status regex is not changed to avoid breaking existing behavior.

### 5.5 Empty Sections
A section heading with no task items below it (followed immediately by another heading or EOF).

**Mitigation**: Already handled — sections with zero items are valid. Fallback sections behave identically.

### 5.6 Emoji in Headings
CongaLine uses headings like `### 9. Remote Provider — ✅ Verified Complete`.

**Mitigation**: Already handled — the `(.+)$` capture group in both strict and loose regexes matches any characters including emoji. The ✅ becomes part of the section title, which is acceptable.

---

## 6. Persona Review

### Architect Review
- **Pattern consistency**: Fallback pattern is applied consistently across both parsers (strict → loose → warning). No new abstraction needed — each parser handles its own fallbacks inline.
- **Synthetic ID collision**: Addressed in edge case 5.2 with monotonic counter starting above highest real ID.
- **API backward compatibility**: `warnings` is optional on `BoardState` — existing consumers that don't check for it are unaffected.
- **No new dependencies**: Pure regex changes. No new packages.

### QA Review
- **Regression risk**: Low. Strict regexes are always tried first. Existing test fixtures all use strict format and will continue to match the strict path.
- **Edge case coverage**: Identified 6 edge cases with mitigations. Each should have a dedicated test.
- **Test fixture strategy**: Use CongaLine's pre-PR-30 format as a realistic integration fixture. Also test mixed-format (some strict, some loose) to verify both paths work in the same document.
- **Warning accuracy**: Every fallback produces a warning with line number and original text — sufficient for debugging.

### Product Manager Review
- **User impact**: Board will render data instead of being empty. Warnings in the API response let the UI eventually surface a "parsing quality" indicator.
- **Scope**: Focused on parsers only. No UI changes in this spec (warning display is a separate concern).
- **Success metric**: Binary — CongaLine pre-PR-30 renders or it doesn't.

---

## 7. Files to Modify

| File | Changes |
|------|---------|
| `src/shared/grammar/types.ts` | Add `ParseWarning` interface; add `warnings?` to `ParsedRoadmap`, `ParsedProjectStatus`, `BoardState` |
| `src/shared/parsers/status-parser.ts` | Add loose section/task regexes, fallback logic, warning emission |
| `src/shared/parsers/roadmap-parser.ts` | Broaden phase regex, add loose section/task regexes, synthetic ID generation, warning emission |
| `src/shared/parsers/board-assembler.ts` | Merge `roadmap.warnings` + `status.warnings` into `BoardState.warnings` |
| `src/shared/grammar/validator.ts` | Downgrade non-critical errors to warnings, accept loose formats |
| `src/shared/parsers/status-parser.test.ts` | Tests for loose sections, loose tasks, mixed format, warnings |
| `src/shared/parsers/roadmap-parser.test.ts` | Tests for broadened phases, loose sections/tasks, synthetic IDs, warnings |
| `src/shared/parsers/board-assembler.test.ts` | Test for warnings merging |
| `src/shared/grammar/validator.test.ts` | Update expectations for downgraded errors, add loose format tests |

**Files NOT changed:**
- `board-service.ts` — warnings flow through automatically via `BoardState`
- `conformance/analyzer.ts` — uses validators which are updated; no code changes needed
- `claims-parser.ts` — claims format is already resilient (M9)
- `spec-parser.ts` — already resilient (M10)
- `activity-parser.ts` — not affected
- Frontend components — warning display is out of scope for this feature
