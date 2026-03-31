# Tasks: Claims Data Model (2.1)

## Documentation Tasks

- [x] **Create claims-format.md**: Write `product-knowledge/standards/claims-format.md` as the dedicated claims format reference document, containing the full BNF grammar from spec.md §1.1, the field semantics table, an annotated example file, the lifecycle state machine from spec.md §2, and the validation rule table from spec.md §3
- [x] **Replace parsing-grammar.md Section 4**: Replace the current 12-line sketch in `product-knowledge/standards/parsing-grammar.md` (lines 120-138) with the complete normative Section 4 matching the level of detail in Sections 1-3; include BNF, full rules list (with all named rule identifiers), active claim resolution semantics, and a cross-reference to `claims-format.md` for extended detail

## Validator Tasks

- [x] **Add CLAIMS.timestamp_order rule**: In `validateClaims()` in `src/shared/grammar/validator.ts`, after a valid entry is matched, parse both `CLAIMED_AT` and `RELEASE_TS` as `Date` objects and emit an error with rule `CLAIMS.timestamp_order` if `RELEASE_TS` is not strictly after `CLAIMED_AT`
- [x] **Add CLAIMS.claimant_format rule**: In `validateClaims()`, after the entry regex matches, validate that the claimant capture group (match[3]) is non-empty and contains no pipe character; emit an error with rule `CLAIMS.claimant_format` if the check fails
- [x] **Add CLAIMS.item_id_format rule**: In `validateClaims()`, validate that the item ID capture group (match[2]) matches `/^\d+\.\d+\.\d+$/`; emit an error with rule `CLAIMS.item_id_format` if it does not; this should be checked for near-valid lines where the overall entry format is recognizable but the item ID is malformed
- [x] **Write tests for CLAIMS.timestamp_order**: Add test cases to `src/shared/grammar/validator.test.ts` in the `validateClaims` describe block — at minimum: (a) a released entry where `RELEASE_TS` equals `CLAIMED_AT` (error), (b) a released entry where `RELEASE_TS` is before `CLAIMED_AT` (error), (c) a valid released entry where `RELEASE_TS` is after `CLAIMED_AT` (no error)
- [x] **Write tests for CLAIMS.claimant_format**: Add test cases — at minimum: (a) a claimant with an embedded pipe character is flagged, (b) a valid claimant passes
- [x] **Write tests for CLAIMS.item_id_format**: Add test cases — at minimum: (a) an item ID with only two segments (e.g., `1.1`) is flagged, (b) an item ID with non-numeric characters is flagged, (c) a valid item ID passes

## Verification Checklist

Before marking this feature done, verify:

- [x] All 7 existing `parseClaims` tests still pass (run via `docker compose run --rm app npx vitest run src/shared/parsers/claims-parser.test.ts`)
- [x] All 5 existing `validateClaims` tests still pass
- [x] All new validator tests pass
- [x] `product-knowledge/standards/claims-format.md` exists and matches the BNF from spec.md §1.1 exactly
- [x] `product-knowledge/standards/parsing-grammar.md` Section 4 has been updated and no longer contains the old 12-line sketch
- [x] The regex in `claims-format.md` and the regex in `claims-parser.ts` are identical
