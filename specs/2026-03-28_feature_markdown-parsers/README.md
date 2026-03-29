# Feature: Markdown Parsers

## Trace Log

### Session 1 — 2026-03-28 — Plan Feature

- **Feature**: 1.2 Markdown Parsers
- **Active Personas**: Architect, QA
- **Status**: Planning

#### Context
With the parsing grammar defined (1.1), implement the parsers that extract structured data from
ROADMAP.md, specs/ directories, PROJECT_STATUS.md, and claims.md. Also implement the unified
board state assembler that merges all parser outputs into a single board model.

#### Dependencies
- 1.1 Parsing Grammar & Contract (complete) — types and grammar spec

### Session 2 — 2026-03-28 — Implement & Verify

- **Status**: Complete

#### Files Created
- `src/shared/parsers/roadmap-parser.ts` — ROADMAP.md parser
- `src/shared/parsers/spec-parser.ts` — Spec directory parser with full phase detection
- `src/shared/parsers/status-parser.ts` — PROJECT_STATUS.md parser
- `src/shared/parsers/claims-parser.ts` — claims.md parser with active claim computation
- `src/shared/parsers/board-assembler.ts` — Unified board state assembler
- `src/shared/parsers/index.ts` — Barrel export
- Tests for all 5 parsers (41 new tests)

#### Files Modified
- `src/shared/grammar/types.ts` — Added BoardCard, BoardColumn, BoardState types

#### Verification Results
- **Tests**: 85/85 passing (44 validator + 41 parser)
- **TypeScript**: Clean
