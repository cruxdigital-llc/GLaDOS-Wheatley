# Plan: Parsing Grammar & Project Scaffold

## Approach

### Part A: Project Scaffold
1. Set up TypeScript configuration (tsconfig.json for server, shared)
2. Install dependencies: vitest, typescript, @types/node
3. Create directory structure: `src/server/`, `src/client/`, `src/shared/`
4. Update Dockerfile to actually build the TypeScript project
5. Update docker-compose.yml for dev workflow
6. Create a smoke test that passes
7. Verify `docker compose run app npm test` works

### Part B: Parsing Grammar Specification
1. Analyze existing GLaDOS artifacts in this repo as reference examples
2. Define ROADMAP.md grammar (phases, numbered items, checkboxes, hierarchy)
3. Define specs/ directory grammar (naming, file presence → phase mapping)
4. Define PROJECT_STATUS.md grammar (sections, task format)
5. Define claims.md grammar (entry format, lifecycle states)
6. Write the grammar as `product-knowledge/standards/parsing-grammar.md`

### Part C: Validation Utility
1. Create `src/shared/grammar/types.ts` — TypeScript types for all parsed artifacts
2. Create `src/shared/grammar/validator.ts` — validation functions for each artifact
3. Create `src/shared/grammar/validator.test.ts` — tests against good and bad inputs
4. Types will be the shared contract used by parsers in feature 1.2

## Architect Review
- Directory structure must support monorepo-style shared code between server and client
- Types defined here become the contract for all downstream features
- Validation utility should be pure functions, no I/O

## QA Review
- Grammar must handle edge cases: empty files, missing sections, malformed checkboxes
- Validator must return structured errors (not just boolean pass/fail)
- Tests must cover both conforming and non-conforming inputs
