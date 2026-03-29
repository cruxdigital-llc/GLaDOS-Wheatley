# Feature: Phase Transition Engine (3.1)

## Summary

This feature implements the engine that governs valid phase transitions on the GLaDOS board. It validates that a requested phase change is legal, determines what markdown files need to be created or updated for each transition, and produces a machine-parseable git commit for every state change.

## Goals

- Define the complete set of valid phase transitions as an explicit, auditable map
- Provide `validateTransition` to reject illegal moves (e.g., `unclaimed → done`) before any file I/O occurs
- Provide `getTransitionActions` to enumerate exactly which files to create or update for each transition
- Implement `TransitionService` to orchestrate validation, file generation, and committing via `GitAdapter.writeFile`
- Expose `POST /api/transitions` so clients can drive phase changes over HTTP
- Produce machine-parseable commit messages (`transition: 1.2.3 unclaimed→planning`) for every transition

## Non-Goals

- UI for triggering transitions (covered by a later frontend feature)
- Automatic / time-triggered transitions (Phase 5)
- Parsing or updating `PROJECT_STATUS.md` (out of scope for this feature)
- Handling transitions that skip multiple phases beyond the one permitted shortcut (`unclaimed → implementing`)

## Design Decisions

- Transition logic lives in `src/shared/transitions/` so it can be imported by both server and future CLI tooling
- `TransitionAction` is a pure data structure; no file I/O happens inside `engine.ts`
- `TransitionService` is the only place that calls `adapter.writeFile`; engine functions are side-effect-free
- Spec directory naming follows the existing convention: `specs/<date>_feature_<kebab-name>/`
- The `verifying → done` transition updates ROADMAP.md to mark the item `[x]`; it does not create spec files

## Key Files

| File | Role |
|---|---|
| `src/shared/transitions/types.ts` | `VALID_TRANSITIONS` map and `TransitionAction` type |
| `src/shared/transitions/engine.ts` | `validateTransition` and `getTransitionActions` |
| `src/server/api/transition-service.ts` | `TransitionService` — orchestrates validation, writes, commits |
| `src/server/api/routes/transitions.ts` | `POST /api/transitions` route handler |
| `src/server/api/server.ts` | Wire `TransitionService` and register routes |
| `src/shared/transitions/__tests__/engine.test.ts` | Unit tests for transition validation and action generation |
| `src/server/api/__tests__/transitions-routes.test.ts` | Route integration tests |
