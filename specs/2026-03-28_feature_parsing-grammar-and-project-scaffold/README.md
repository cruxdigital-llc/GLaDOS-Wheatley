# Feature: Parsing Grammar & Project Scaffold

## Trace Log

### Session 1 — 2026-03-28 — Plan Feature

- **Feature**: 1.1 Parsing Grammar & Contract (+ project scaffold bootstrap)
- **Active Personas**: Architect, QA
- **Status**: Planning

#### Context
This is the foundational feature for Wheatley. Before any parsers, APIs, or UI can be built, we need:
1. A working TypeScript project scaffold that builds and tests inside Docker
2. A strict, machine-readable grammar specification for all GLaDOS artifacts Wheatley will parse

#### Decisions
- Combining project scaffold setup with grammar definition since neither can be tested independently
- Architect persona involved for structural decisions
- QA persona involved to ensure the grammar is unambiguous and testable

### Session 2 — 2026-03-28 — Implement & Verify

- **Status**: Complete

#### Files Created
- `tsconfig.json` — TypeScript config with strict mode
- `vitest.config.ts` — Vitest configuration
- `src/shared/grammar/types.ts` — All TypeScript types for parsed GLaDOS artifacts
- `src/shared/grammar/validator.ts` — Validation functions for ROADMAP.md, specs/, PROJECT_STATUS.md, claims.md
- `src/shared/grammar/validator.test.ts` — 30 tests covering valid inputs, edge cases, and malformed inputs
- `src/server/index.ts` — Server entry point placeholder
- `product-knowledge/standards/parsing-grammar.md` — Full grammar specification

#### Files Modified
- `package.json` — Added devDependencies (vitest, typescript, @types/node)
- `Dockerfile` — Updated for TypeScript build pipeline
- `docker-compose.yml` — Updated for dev workflow with source mounts

#### Verification Results
- **Tests**: 30/30 passing
- **TypeScript**: Clean (no errors with --noEmit)
- **Docker**: Builds and runs successfully
