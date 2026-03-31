# Plan: Claims Data Model (2.1)

## Context

Phase 1 shipped claims parsing and validation as a "readiness" deliverable for Phase 2. The implementation is correct and fully tested. What is missing is the formal specification layer: the documents that make `claims.md` a first-class artifact in the Wheatley grammar standard, on equal footing with `ROADMAP.md`, `PROJECT_STATUS.md`, and the `specs/` directory.

## Approach

This feature is entirely documentation-first with one targeted validator extension. There are three deliverables:

**Deliverable 1 — `product-knowledge/standards/claims-format.md`**

A standalone reference document for the `claims.md` format. This is the canonical home for the claims grammar, lifecycle rules, and examples. It serves two audiences: (1) GLaDOS agents that write to `claims.md`, and (2) developers extending or replacing the Wheatley parser.

**Deliverable 2 — Extended `parsing-grammar.md` Section 4**

The existing Section 4 in `parsing-grammar.md` is a sketch (5 lines of BNF, 3 rules). It must be replaced with a complete, normative section that matches the level of detail in Sections 1-3. This includes full BNF, named validation rules, lifecycle semantics, and ordering rules.

**Deliverable 3 — Validator gap closure in `validator.ts`**

Three new checks that the spec will formally require but the current validator does not perform:
1. `CLAIMS.timestamp_order` — `releasedAt` must be after `claimedAt`
2. `CLAIMS.claimant_format` — claimant must be non-empty and contain no pipe characters
3. `CLAIMS.item_id_format` — item ID must match `\d+\.\d+\.\d+`

Note: rule 3 is already enforced by the entry-format regex, but the malformed-entry error currently fires as `CLAIMS.entry_format`. Adding a distinct named rule allows callers to distinguish "the whole line is garbage" from "the item ID is specifically malformed."

## Architecture

No architectural changes. This feature operates entirely within:
- `product-knowledge/standards/` (documentation)
- `src/shared/grammar/validator.ts` (new checks within `validateClaims`)
- `src/shared/grammar/validator.test.ts` (new tests for the new rules)

## Key Design Decisions

**Release timestamp: warning vs error**

The current validator warns (not errors) when a `released` or `expired` entry lacks a `releasedAt` timestamp. This is a deliberate choice: GLaDOS might write a release entry before it can compute the exact release time, or a human editing the file manually might omit it. The spec will document this as an intentional choice and label it a "should" (not "must") requirement. If the team wants to harden this to an error in the future, that is a separate change.

**Claimant format**

The claimant field in the existing regex is `(.+?)` — any non-empty string that doesn't span to the next `|`. The new `CLAIMS.claimant_format` rule will enforce two things the regex already implicitly rejects: (1) empty string (the `+` quantifier prevents this), and (2) embedded pipes (the `?` lazy match before ` | ` prevents this). Adding an explicit named rule makes the constraint discoverable and testable in isolation from the general entry format.

**"Last entry wins" vs strict ordering**

The parser correctly implements last-entry-wins. The spec will document this as a deliberate simplicity choice. A stricter alternative would be to error on a `claimed` entry for an item that already has an active claim (conflict detection), but that is deferred to Phase 2.2 (backend conflict detection at write time). The read-path parser remains permissive.

## Out of Scope

- Expiry TTL computation (Phase 5.2)
- Cross-branch claim reads (Phase 2.4)
- Write API for creating/releasing claims (Phase 2.2)
- Any changes to `ClaimEntry`, `ClaimStatus`, or `ParsedClaims` types
