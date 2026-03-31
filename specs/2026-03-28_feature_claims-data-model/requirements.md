# Requirements: Claims Data Model (2.1)

## Functional Requirements

### FR-1: Formal claims.md format specification

The `claims.md` format must be specified as a normative document in `product-knowledge/standards/`. The specification must be complete enough that two independent parsers, reading only the spec, would produce identical output from the same input file.

**Acceptance criteria:**
- A dedicated `claims-format.md` exists in `product-knowledge/standards/` with a BNF-style grammar
- The grammar covers every field in `ClaimEntry`: status, itemId, claimant, claimedAt, releasedAt
- The grammar matches the regex already implemented in `claims-parser.ts` exactly: `- [(claimed|released|expired)] {itemId} | {claimant} | {timestamp}( | {timestamp})?`
- The document specifies which fields are required vs optional for each status value

### FR-2: Claim lifecycle state machine

The three claim statuses (`claimed`, `released`, `expired`) must be specified as a formal state machine with defined transitions and invariants.

**Acceptance criteria:**
- The lifecycle document defines the valid initial state (only `claimed` is a valid first entry for an item)
- The lifecycle document defines valid transitions: `claimed → released`, `claimed → expired`
- The lifecycle document specifies that `released` and `expired` are terminal states for a given claim epoch; a new `claimed` entry starts a new epoch
- The lifecycle document defines what "active claim" means: the most recent entry for an item ID where status is `claimed`
- The lifecycle document defines the "last entry wins" resolution rule for multiple entries with the same item ID
- The lifecycle document specifies that `releasedAt` is required for `released` and `expired` entries (currently a warning in the validator; the spec should clarify the intended strictness level)

### FR-3: Extended grammar specification

`product-knowledge/standards/parsing-grammar.md` Section 4 must be extended with the lifecycle rules and validation rule names so that `validator.ts` can be verified against the spec.

**Acceptance criteria:**
- Section 4 lists all validation rule names (e.g., `CLAIMS.title`, `CLAIMS.entry_format`) and their definitions
- Section 4 documents the ordering semantics: entries are processed chronologically (top-to-bottom); the last entry per item ID wins
- Section 4 specifies that an empty `claims.md` file is valid (zero claims)
- Section 4 documents the GLaDOS header comment as optional (consistent with other artifacts)

### FR-4: Validator gap closure

The existing `validateClaims()` in `validator.ts` must be extended to cover invariants not yet checked.

**Acceptance criteria:**
- Validator checks that `releasedAt` timestamp is strictly after `claimedAt` timestamp when both are present (new rule: `CLAIMS.timestamp_order`)
- Validator checks that claimant is non-empty and contains no pipe (`|`) characters (new rule: `CLAIMS.claimant_format`)
- Validator checks that item ID conforms to `\d+\.\d+\.\d+` format (currently matched by the entry regex, but not reported with a named rule; add `CLAIMS.item_id_format`)
- All new validation rules have corresponding tests in `validator.test.ts`

## Non-Functional Requirements

### NFR-1: Backward compatibility

No changes to the parser or type definitions are permitted. The 7 existing `parseClaims` tests and 5 existing `validateClaims` tests must continue to pass without modification.

### NFR-2: Consistency with existing grammar document

The claims format specification must use the same BNF notation and terminology as the existing sections in `parsing-grammar.md`.

### NFR-3: Implementation-first accuracy

The specification must accurately describe the implementation that already exists, not a hypothetical ideal. Where the implementation has made a choice (e.g., warnings vs errors for missing release timestamps), the spec must document that choice and, if a different policy is preferred, flag it as a future change rather than silently contradicting the implementation.

## Constraints

- All specification documents are plain markdown files in `product-knowledge/standards/`
- No new TypeScript source files are created in this feature — only specification documents and validator additions
- The GLaDOS header comment (`<!-- GLaDOS-MANAGED DOCUMENT -->`) format used in other artifacts in this repo must be included in the claims format spec
