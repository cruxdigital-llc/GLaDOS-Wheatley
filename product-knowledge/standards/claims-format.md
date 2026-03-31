<!--
GLaDOS-MANAGED DOCUMENT
Last Updated: 2026-03-28
To modify: Edit this file directly.
-->

# Claims Format Reference

This document is the normative reference for the `claims.md` file format. It defines the BNF grammar, field semantics, example content, the lifecycle state machine, and the named validation rules enforced by `validateClaims()` in `src/shared/grammar/validator.ts`.

See also: `product-knowledge/standards/parsing-grammar.md` Section 4 for the summary grammar used by Wheatley's parser registry.

---

## 1. BNF Grammar

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

---

## 2. Field Semantics

| Field | Required | Notes |
|---|---|---|
| `CLAIM_STATUS` | Always | One of `claimed`, `released`, `expired` |
| `ITEM_ID` | Always | Roadmap item ID in `{phase}.{section}.{item}` format |
| `CLAIMANT` | Always | Identity string; no embedded pipes; non-empty |
| `CLAIMED_AT` | Always | UTC ISO 8601 timestamp of when the claim was created |
| `RELEASE_TS` | Conditional | Required for `released` and `expired` entries (see §4.3). Must be strictly after `CLAIMED_AT` when present. |

---

## 3. Annotated Example File

```markdown
<!--
GLaDOS-MANAGED DOCUMENT
Last Updated: 2026-03-28
To modify: Append entries using the format below.
-->

# Claims

- [claimed] 2.1.1 | jed2nd | 2026-03-28T20:00:00Z
- [claimed] 2.1.2 | agent-claude | 2026-03-28T20:05:00Z
- [released] 2.1.2 | agent-claude | 2026-03-28T20:05:00Z | 2026-03-28T21:00:00Z
- [expired] 1.3.1 | agent-old | 2026-03-20T09:00:00Z | 2026-03-21T09:00:00Z
- [claimed] 2.1.2 | jed2nd | 2026-03-28T21:05:00Z
```

Annotations:

- Line 1–5: Optional GLaDOS-managed header comment — stripped before parsing.
- Line 7: Required `# Claims` title.
- Line 9: Active claim on item `2.1.1` held by `jed2nd`.
- Line 10: Claim on `2.1.2` by `agent-claude` — later superseded.
- Line 11: `released` entry for `2.1.2` by `agent-claude`; `RELEASE_TS` present and after `CLAIMED_AT`. Clears the active claim for `2.1.2`.
- Line 12: `expired` entry for `1.3.1`; TTL-based or operator-revoked release.
- Line 13: New `claimed` epoch on `2.1.2` by `jed2nd`; this is the active claim after full resolution.

Active claims after full resolution:
- `2.1.1` claimed by `jed2nd`
- `2.1.2` claimed by `jed2nd` (re-claimed after `agent-claude` released it)

---

## 4. Claim Lifecycle State Machine

### 4.1 States

| State | Meaning |
|---|---|
| `claimed` | The item is actively held by the claimant |
| `released` | The claimant voluntarily released the item before completion |
| `expired` | The claim was revoked (TTL exceeded or force-released by an operator) |

### 4.2 Transitions

```
(new epoch) ──► claimed ──► released
                       └──► expired
```

- `claimed` is the only valid initial state for a new claim epoch on an item.
- `released` and `expired` are terminal states within a claim epoch.
- A new `claimed` entry for the same item after a `released` or `expired` entry starts a fresh epoch.
- There is no direct `released → claimed` or `expired → claimed` transition within a single epoch; re-claiming creates a new entry.

### 4.3 Release Timestamp Policy

For `released` and `expired` entries, the `RELEASE_TS` field **should** be present and must be a UTC ISO 8601 timestamp strictly after `CLAIMED_AT`. The current validator emits a **warning** (not an error) when `RELEASE_TS` is absent, to accommodate scenarios where a release entry is written before the exact release time is known.

Future hardening: if the team decides to enforce `RELEASE_TS` as a strict requirement, the rule `CLAIMS.release_ts_required` should be promoted from a warning to an error, and the validator updated accordingly.

### 4.4 Active Claim Resolution

The parser resolves the active claimant for each item ID as follows:

1. Process all entries in document order (top-to-bottom).
2. For each entry, apply the last-entry-wins rule:
   - If status is `claimed`: set this entry as the active claim for `itemId`.
   - If status is `released` or `expired`: remove any active claim for `itemId`.
3. The `activeClaims` map at the end of processing reflects the current board state.

If a file contains duplicate `claimed` entries for the same item (e.g., due to a write race), the later entry in the file wins. Write-time conflict detection (Phase 2.2) is responsible for preventing this; the parser is intentionally permissive.

---

## 5. Validation Rules

These are the named validation rules enforced by `validateClaims()` in `src/shared/grammar/validator.ts`.

### 5.1 Phase 1 Rules (existing)

| Rule | Severity | Condition |
|---|---|---|
| `CLAIMS.title` | Error | File is non-empty but does not contain `# Claims` as a top-level heading |
| `CLAIMS.entry_format` | Error | A line starting with `- [` does not match the full claim entry pattern and no more specific rule applies |
| `CLAIMS.release_ts_required` | Warning | A `released` or `expired` entry lacks a `RELEASE_TS` field |

### 5.2 Phase 2.1 Rules (new)

| Rule | Severity | Condition |
|---|---|---|
| `CLAIMS.timestamp_order` | Error | `RELEASE_TS` is present but is not strictly after `CLAIMED_AT` |
| `CLAIMS.claimant_format` | Error | Claimant field is empty or contains a pipe character |
| `CLAIMS.item_id_format` | Error | Item ID field does not match `\d+\.\d+\.\d+` |

### 5.3 Rule Priority

Specific field rules (`CLAIMS.claimant_format`, `CLAIMS.item_id_format`) are checked before the general `CLAIMS.entry_format` rule. When a line is close to valid but fails on a single field, the specific rule is emitted and the general rule is suppressed. The general `CLAIMS.entry_format` rule fires only when the line structure is unrecognizable.

---

## 6. Conformance

A `claims.md` file conforms to this specification if and only if `validateClaims()` returns `{ valid: true }` with no errors. Warnings are permitted in a conformant file.

An empty file (zero bytes or whitespace only) is conformant and represents a board with no claims.
