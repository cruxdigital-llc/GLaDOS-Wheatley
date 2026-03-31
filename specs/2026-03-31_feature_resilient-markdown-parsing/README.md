# Feature Trace: Resilient Markdown Parsing

**Created**: 2026-03-31
**Status**: Speccing
**Lead**: Architect + QA + Product Manager

## Active Personas
- Architect — parser architecture, regex design, fallback patterns
- QA — edge case coverage, regression testing, fixture-based tests
- Product Manager — user impact prioritization, success criteria

## Session Log

### 2026-03-31 — Planning Session

**Context**: When pointing Wheatley at CongaLine's GLaDOS-managed repo, the board rendered mostly empty. CongaLine PR #30 required extensive manual cleanup of markdown to match Wheatley's rigid structural expectations. This feature makes Wheatley resilient to real-world GLaDOS markdown that doesn't perfectly match the strict parsing grammar.

**Goal**: Graceful degradation (parse what you can, show partial data) plus diagnostic warnings (tell users what couldn't be parsed and why).

**Success Criteria**: Wheatley renders CongaLine's original GLaDOS markdown (before PR #30 cleanup) correctly on the board.

**Analysis**: Identified 10 structural mismatches between CongaLine's markdown and Wheatley's parsers (see requirements.md for full breakdown).

### 2026-03-31 — Spec Session

**Spec created**: `spec.md` — detailed technical specification covering:
- `ParseWarning` type addition to `types.ts` and `BoardState`
- Fallback regex patterns for `status-parser.ts` (unnumbered sections, plain-text tasks)
- Fallback regex patterns for `roadmap-parser.ts` (flexible separators, synthetic IDs)
- Validator relaxation (non-critical errors → warnings)
- 6 edge cases analyzed with mitigations (ambiguous headings, ID collisions, non-checkbox brackets, uppercase X, empty sections, emoji)

**Persona review**: Architect (pattern consistency, API compat), QA (regression risk, edge cases, fixture strategy), Product Manager (user impact, scope guard, success metric) — all approved.

**Standards gate**: `parsing-grammar.md` is the relevant standard. The grammar document defines the ideal format; this feature makes parsers tolerant of deviations while preserving the grammar as the canonical reference. No grammar document changes needed.
