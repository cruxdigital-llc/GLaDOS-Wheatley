<!--
GLaDOS-MANAGED DOCUMENT
Last Updated: 2026-03-28
To modify: Edit this file directly.
-->

# Wheatley Parsing Grammar Standard

This document defines the strict, machine-readable grammar for all GLaDOS artifacts that Wheatley parses. Two independent parsers implementing this grammar must produce identical board state from the same repository.

## 1. ROADMAP.md

### Structure

```
ROADMAP      := HEADER PHASE+
HEADER       := HTML_COMMENT? BLANK_LINE* "# Roadmap" BLANK_LINE
PHASE        := PHASE_HEADING BLANK_LINE GOAL BLANK_LINE SECTION+
PHASE_HEADING:= "## Phase " PHASE_NUM ": " PHASE_NAME
PHASE_NUM    := INTEGER
PHASE_NAME   := TEXT_TO_EOL
GOAL         := "**Goal**: " TEXT_TO_EOL
SECTION      := SECTION_HEADING BLANK_LINE TASK_ITEM+
SECTION_HEADING := "### " SECTION_ID " " SECTION_NAME
SECTION_ID   := PHASE_NUM "." INTEGER
SECTION_NAME := TEXT_TO_EOL
TASK_ITEM    := "- [" STATUS "] " ITEM_ID " " ITEM_TEXT NEWLINE
STATUS       := " " | "x"
ITEM_ID      := PHASE_NUM "." INTEGER "." INTEGER
ITEM_TEXT    := TEXT_TO_EOL
```

### Rules
- Phase numbers are sequential starting from 1
- Section IDs are `{phase}.{section}` — section numbers are sequential within each phase starting from 1
- Item IDs are `{phase}.{section}.{item}` — item numbers are sequential within each section starting from 1
- `[ ]` = incomplete, `[x]` = complete
- `HTML_COMMENT` is the optional GLaDOS header comment block (`<!-- ... -->`)
- Blank lines between sections are required
- Extra whitespace at end of lines is ignored

### Extraction
Each `TASK_ITEM` maps to a board card with:
- `id` = ITEM_ID
- `title` = ITEM_TEXT
- `completed` = STATUS == "x"
- `sectionTitle` = parent SECTION_NAME
- `phaseTitle` = parent PHASE_NAME

## 2. specs/ Directory

### Directory Naming

```
SPEC_DIR     := "specs/" DATE "_" PREFIX "_" KEBAB_NAME "/"
DATE         := /\d{4}-\d{2}-\d{2}/
PREFIX       := "feature" | "fix" | "mission-statement" | "plan-product"
KEBAB_NAME   := /[a-z0-9]+(-[a-z0-9]+)*/
```

Directories that do not match this pattern are ignored (not an error).

### Phase Detection

Phase is determined by which files are present. Rules are evaluated in order; first match wins:

| Priority | Condition | Phase |
|---|---|---|
| 1 | `tasks.md` exists AND all task checkboxes are `[x]` AND `README.md` contains "verify" session log | `done` |
| 2 | `tasks.md` exists AND all task checkboxes are `[x]` | `verifying` |
| 3 | `tasks.md` exists | `implementing` |
| 4 | `spec.md` exists | `speccing` |
| 5 | `plan.md` OR `requirements.md` exists | `planning` |
| 6 | Only `README.md` exists | `unclaimed` |

### Required Files Per Phase

| Phase | Required Files |
|---|---|
| unclaimed | `README.md` |
| planning | `README.md`, `requirements.md`, `plan.md` |
| speccing | `README.md`, `requirements.md`, `plan.md`, `spec.md` |
| implementing | `README.md`, `requirements.md`, `plan.md`, `spec.md`, `tasks.md` |
| verifying | Same as implementing, all tasks complete |
| done | Same as verifying, plus verification log in README |

## 3. PROJECT_STATUS.md

### Structure

```
STATUS_DOC   := HEADER OVERVIEW ARCHITECTURE FOCUS KNOWN_ISSUES RECENT_CHANGES
HEADER       := HTML_COMMENT? BLANK_LINE* "# " TITLE BLANK_LINE
OVERVIEW     := "## Project Overview" BLANK_LINE FIELD* TEXT*
ARCHITECTURE := "## Architecture" BLANK_LINE TEXT+
FOCUS        := "## Current Focus" BLANK_LINE FOCUS_SECTION+
FOCUS_SECTION:= "### " SECTION_NUM ". " SECTION_TITLE BLANK_LINE LEAD? TASK_LINE+
SECTION_NUM  := INTEGER
SECTION_TITLE:= TEXT_TO_EOL
LEAD         := "*Lead: " TEXT "*" NEWLINE BLANK_LINE?
TASK_LINE    := "- [" STATUS "] **" LABEL "**: " DESCRIPTION NEWLINE
STATUS       := " " | "x"
LABEL        := TEXT (no ** allowed inside)
DESCRIPTION  := TEXT_TO_EOL
KNOWN_ISSUES := "## Known Issues / Technical Debt" BLANK_LINE TEXT+
RECENT_CHANGES := "## Recent Changes" BLANK_LINE CHANGE_LINE+
CHANGE_LINE  := "- " DATE ": " TEXT_TO_EOL NEWLINE
```

### Extraction
Each `TASK_LINE` in a `FOCUS_SECTION` maps to an active task with:
- `label` = LABEL
- `description` = DESCRIPTION
- `completed` = STATUS == "x"
- `section` = parent SECTION_TITLE
- `lead` = LEAD text if present

Sections titled "Backlog / Upcoming" are treated as backlog items, not active tasks.

## 4. claims.md

### Structure

```
CLAIMS_DOC   := HEADER "# Claims" BLANK_LINE CLAIM_ENTRY*
HEADER       := HTML_COMMENT? BLANK_LINE*
CLAIM_ENTRY  := "- [" CLAIM_STATUS "] " ITEM_ID " | " CLAIMANT " | " TIMESTAMP (" | " TIMESTAMP)? NEWLINE
CLAIM_STATUS := "claimed" | "released" | "expired"
ITEM_ID      := /\d+\.\d+\.\d+/
CLAIMANT     := TEXT (no | allowed)
TIMESTAMP    := ISO_8601 (e.g., "2026-03-28T20:00:00Z")
```

### Rules
- The second timestamp (if present) is the release/expiry time
- Multiple entries for the same ITEM_ID may exist; the last entry wins
- Only entries with status `claimed` represent active claims

## 5. Common Definitions

```
TEXT_TO_EOL  := /[^\n]+/
TEXT         := /[^\n]+/
BLANK_LINE   := /^\s*$/
NEWLINE      := "\n" | "\r\n"
INTEGER      := /[1-9]\d*/
ISO_8601     := /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/
HTML_COMMENT := "<!--" TEXT "-->"  (may span multiple lines)
```

All parsers must normalize CRLF to LF before processing.
Trailing whitespace on any line is ignored.
