# Feature: Claims Data Model (2.1)

## Summary

This feature formalizes the `claims.md` format and claim lifecycle as the authoritative specification for Phase 2. Phase 1 shipped a parser (`claims-parser.ts`), a validator (`validateClaims` in `validator.ts`), types (`ClaimEntry`, `ClaimStatus`, `ParsedClaims` in `types.ts`), and 7 passing tests — all in a "Phase 2 readiness" posture. This feature does not rewrite that code. It establishes the missing formal specification artifacts that the existing implementation was written against informally, and identifies the gaps that remain.

## Goals

- Produce a formal `claims.md` format specification in `product-knowledge/standards/` that documents the grammar already implemented, making it the single source of truth
- Formally define the claim lifecycle state machine (claimed → released, claimed → expired) with precise transition rules and invariants
- Extend `product-knowledge/standards/parsing-grammar.md` with a complete, normative Section 4 for `claims.md` (the current Section 4 is a sketch; it lacks lifecycle rules, ordering semantics, conflict resolution, and validation rule names)
- Identify and document the gaps in the existing validator (`validateClaims`) relative to the formal spec, so they can be addressed in implementation

## Non-Goals

- Writing backend claim creation or release endpoints (Phase 2.2)
- Any UI work (Phase 2.3)
- Cross-branch claim visibility (Phase 2.4)
- TTL / auto-expiry logic (Phase 5.2)
- Changing any existing passing tests or parser behavior — the Phase 1 implementation is correct and should not be touched

## Current State (Phase 1 Deliverables)

The following already exists and is covered by tests:

| Artifact | Location | Status |
|---|---|---|
| `ClaimStatus` type (`claimed`, `released`, `expired`) | `src/shared/grammar/types.ts:115` | Done |
| `ClaimEntry` interface | `src/shared/grammar/types.ts:117` | Done |
| `ParsedClaims` interface | `src/shared/grammar/types.ts:130` | Done |
| `parseClaims()` function | `src/shared/parsers/claims-parser.ts` | Done, 7 tests |
| `validateClaims()` function | `src/shared/grammar/validator.ts:430` | Done, 5 tests |
| Grammar sketch (Section 4) | `product-knowledge/standards/parsing-grammar.md:120` | Partial — missing lifecycle rules |
| Board assembler claim attachment | `src/shared/parsers/board-assembler.ts:113` | Done |

## Remaining Work

1. Expand `product-knowledge/standards/parsing-grammar.md` Section 4 with formal lifecycle rules
2. Create `product-knowledge/standards/claims-format.md` as the dedicated claims format reference
3. Add validator coverage for ordering invariants (e.g., release timestamp must be after claim timestamp)
4. Add validator coverage for claimant format constraints (no pipe characters, non-empty)
