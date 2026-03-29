# Plan: Markdown Parsers

## Approach

### Files to Create
1. `src/shared/parsers/roadmap-parser.ts` — Parse ROADMAP.md into `ParsedRoadmap`
2. `src/shared/parsers/spec-parser.ts` — Parse spec directory listings into `SpecEntry[]`
3. `src/shared/parsers/status-parser.ts` — Parse PROJECT_STATUS.md into `ParsedProjectStatus`
4. `src/shared/parsers/claims-parser.ts` — Parse claims.md into `ParsedClaims`
5. `src/shared/parsers/board-assembler.ts` — Merge parser outputs into unified board model
6. `src/shared/parsers/index.ts` — Re-export all parsers
7. Tests for each (co-located as `*.test.ts`)

### Design Decisions
- Parsers are pure functions: string in, structured data out
- Parsers should never throw — return partial results with warnings
- Reuse regex patterns from the validator where possible
- Board assembler creates the column-based view by mapping items to phases

### Board State Model
The assembled board state will be the API response shape:
- `columns`: Array of columns (one per phase), each containing cards
- `cards`: Each card has an ID, title, phase, spec link, claim info
- Sources are cross-referenced: a roadmap item links to its spec directory (by name match)
