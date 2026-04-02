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

For extended detail, annotated examples, and the full lifecycle specification, see `product-knowledge/standards/claims-format.md`.

### Structure

```
CLAIMS_DOC     := HEADER TITLE BLANK_LINE CLAIM_ENTRY*
HEADER         := HTML_COMMENT? BLANK_LINE*
HTML_COMMENT   := "<!--" TEXT "-->"  (may span multiple lines)
TITLE          := "# Claims" NEWLINE
BLANK_LINE     := /^\s*$/ NEWLINE
CLAIM_ENTRY    := "- [" CLAIM_STATUS "] " ITEM_ID " | " CLAIMANT " | " CLAIMED_AT RELEASE_TS? NEWLINE
CLAIM_STATUS   := "claimed" | "released" | "expired"
ITEM_ID        := /\d+\.\d+\.\d+/
CLAIMANT       := /[^|\n]+/  (non-empty, no pipe character)
CLAIMED_AT     := ISO_8601
RELEASE_TS     := " | " ISO_8601
ISO_8601       := /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/
NEWLINE        := "\n" | "\r\n"
```

This grammar matches exactly the regex implemented in `claims-parser.ts`:

```
/^- \[(claimed|released|expired)\] (\d+\.\d+\.\d+) \| (.+?) \| (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)( \| (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z))?$/
```

### Rules

| Rule | Severity | Condition |
|---|---|---|
| `CLAIMS.title` | Error | File is non-empty but does not contain `# Claims` as a top-level heading |
| `CLAIMS.entry_format` | Error | A line starting with `- [` does not match the full claim entry pattern and no more specific rule applies |
| `CLAIMS.release_ts_required` | Warning | A `released` or `expired` entry lacks a `RELEASE_TS` field |
| `CLAIMS.timestamp_order` | Error | `RELEASE_TS` is present but is not strictly after `CLAIMED_AT` |
| `CLAIMS.claimant_format` | Error | Claimant field is empty or contains a pipe character |
| `CLAIMS.item_id_format` | Error | Item ID field does not match `\d+\.\d+\.\d+` |

Specific field rules (`CLAIMS.claimant_format`, `CLAIMS.item_id_format`) take priority over the general `CLAIMS.entry_format` rule when the line structure is recognizable but a single field is malformed.

### Lifecycle States

| State | Meaning |
|---|---|
| `claimed` | Item is actively held by the claimant |
| `released` | Claimant voluntarily released the item |
| `expired` | Claim was revoked (TTL exceeded or operator force-released) |

Transitions: `(new epoch) → claimed → released` or `claimed → expired`. `released` and `expired` are terminal within a claim epoch; re-claiming the same item starts a new entry.

### Active Claim Resolution

Process all entries in document order. For each entry:
- If status is `claimed`: set this entry as the active claim for `ITEM_ID`
- If status is `released` or `expired`: remove the active claim for `ITEM_ID`

Last entry wins when duplicates exist. The `activeClaims` map after full processing reflects current board state.

### Extraction

Each `CLAIM_ENTRY` maps to a `ClaimEntry` record with:
- `itemId` = ITEM_ID
- `claimant` = CLAIMANT
- `status` = CLAIM_STATUS
- `claimedAt` = CLAIMED_AT (parsed as `Date`)
- `releasedAt` = RELEASE_TS if present (parsed as `Date`), otherwise `undefined`

The `ParsedClaims` result also exposes `activeClaims: Map<itemId, ClaimEntry>` representing the resolved active board state.

## 5. SPEC_LOG.md

### Structure

```
SPEC_LOG     := HEADER BLANK_LINE DIVIDER BLANK_LINE SECTION TABLE
HEADER       := "# Spec Log" BLANK_LINE DESCRIPTION+
DESCRIPTION  := TEXT_TO_EOL NEWLINE
DIVIDER      := "---"
SECTION      := "## Implemented" BLANK_LINE
TABLE        := TABLE_HEADER TABLE_SEPARATOR TABLE_ROW*
TABLE_HEADER := "| Date | Spec | Merge Commit | Summary |"
TABLE_SEPARATOR := "|------|------|:------------:|---------|"
TABLE_ROW    := "| " DATE " | " SPEC_DIR " | " SHORT_SHA " | " SUMMARY " |"
DATE         := /\d{4}-\d{2}-\d{2}/
SPEC_DIR     := TEXT
SHORT_SHA    := /[a-f0-9]{7}/
SUMMARY      := TEXT
```

### Extraction

Each `TABLE_ROW` maps to a `SpecLogEntry` record with:
- `date` = DATE (ISO 8601 date string)
- `specDir` = SPEC_DIR (original spec directory name)
- `commitHash` = SHORT_SHA (7-char abbreviated commit hash)
- `summary` = SUMMARY (human-readable description of what was built)

Entries are in reverse chronological order (newest first).

## 6. Common Definitions

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
