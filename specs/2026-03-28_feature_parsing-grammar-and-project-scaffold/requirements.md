# Requirements: Parsing Grammar & Project Scaffold

## Goal
Define a strict, machine-readable parsing grammar for all GLaDOS artifacts that Wheatley reads, and establish the TypeScript project scaffold that all subsequent features will build on.

## Success Criteria

### Project Scaffold
1. TypeScript project compiles with strict mode
2. `docker compose up --build` starts a working dev environment
3. `docker compose run app npm test` runs tests successfully
4. Vitest configured and passing with at least one smoke test
5. Source directory structure established (`src/server/`, `src/client/`, `src/shared/`)

### Parsing Grammar
1. ROADMAP.md grammar: unambiguous specification for task items, phases, numbered hierarchy, checkbox status
2. specs/ directory grammar: naming convention, required files per phase, phase detection rules
3. PROJECT_STATUS.md grammar: active task extraction, section structure
4. claims.md grammar: claim entry format (read-only in Phase 1, but grammar defined now)
5. Grammar documented as a standard in `product-knowledge/standards/parsing-grammar.md`
6. A TypeScript validation utility that checks conformance and returns structured errors
7. The grammar must be strict enough that two independent parsers would produce identical board state from the same repo

## Non-Goals
- Implementing the full parsers (that's feature 1.2)
- Implementing the git adapter (that's feature 1.3)
- Fuzzy matching or heuristic parsing
