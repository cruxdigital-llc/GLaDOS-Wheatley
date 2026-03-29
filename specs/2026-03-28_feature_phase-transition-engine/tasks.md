# Tasks: Phase Transition Engine (3.1)

## Implementation Tasks

- [x] **3.1.1 Define valid phase transitions**: Create `src/shared/transitions/types.ts` with `VALID_TRANSITIONS: Map<BoardPhase, BoardPhase[]>` and `TransitionAction` interface
- [x] **3.1.2 Transition action generation**: Create `src/shared/transitions/engine.ts` with `validateTransition` and `getTransitionActions`; pure functions with no I/O
- [x] **3.1.3 TransitionService**: Create `src/server/api/transition-service.ts` with `TransitionService` class and `InvalidTransitionError`; orchestrates validation, action generation, and adapter writes
- [x] **3.1.4 Transition validation**: `validateTransition` returns `{ valid: false, reason }` for all invalid transitions; prevents backward moves, same-phase moves, and jumps beyond the permitted shortcut
- [x] **POST /api/transitions route**: Create `src/server/api/routes/transitions.ts`; validate body, delegate to `TransitionService`, return 200/400/409
- [x] **Wire into server**: Import `TransitionService` and `transitionRoutes` in `src/server/api/server.ts`; instantiate service and register routes

## Test Tasks

- [x] **Unit tests: validateTransition — valid cases**: All entries in `VALID_TRANSITIONS` return `{ valid: true }`; include the `unclaimed → implementing` shortcut
- [x] **Unit tests: validateTransition — invalid cases**: Backward transitions, same-phase, skip-multiple-phases, `done → *` all return `{ valid: false }`
- [x] **Unit tests: getTransitionActions — unclaimed→planning**: Returns single README.md action with correct path and content
- [x] **Unit tests: getTransitionActions — planning→speccing**: Returns spec.md and requirements.md actions
- [x] **Unit tests: getTransitionActions — speccing→implementing**: Returns tasks.md action with unchecked checkbox
- [x] **Unit tests: getTransitionActions — implementing→verifying**: Returns tasks.md overwrite with all `[x]`
- [x] **Unit tests: getTransitionActions — verifying→done**: Returns ROADMAP.md action with `MARK_DONE:<itemId>` sentinel
- [x] **Unit tests: getTransitionActions — unclaimed→implementing**: Returns README.md and tasks.md
- [x] **Unit tests: getTransitionActions — invalid transition**: Returns empty array
- [x] **Route tests: 200 on valid transition**: Mock adapter, POST with valid body, expect 200 and writeFile called
- [x] **Route tests: 400 on invalid transition**: POST with `unclaimed → done`, expect 400
- [x] **Route tests: 400 on missing body fields**: POST without `from` or `to`, expect 400
- [x] **Route tests: 400 on unknown phase value**: POST with `from: "unknown"`, expect 400
- [x] **Route tests: 409 on ConflictError**: Mock adapter throws `ConflictError`, expect 409 with `conflict: true`
- [x] **Route tests: commit message format**: Verify `adapter.writeFile` called with `transition: <itemId> <from>→<to>` message

## Verification Checklist

Before marking this feature done, verify:

- [x] All valid transitions in `VALID_TRANSITIONS` are exercised by tests
- [x] All invalid transitions tested return `{ valid: false }` with a non-empty reason
- [x] Each transition produces the expected set of `TransitionAction` objects
- [x] `TransitionService.executeTransition` calls `adapter.writeFile` once per action
- [x] Commit messages use `→` (U+2192), not `->`
- [x] `POST /api/transitions` returns 200 on success and 400 for invalid transitions
- [x] `ConflictError` from the adapter surfaces as HTTP 409 with `{ conflict: true }`
- [x] At least 15 new tests are present across engine and route test files
