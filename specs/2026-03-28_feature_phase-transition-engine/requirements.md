# Requirements: Phase Transition Engine (3.1)

## Functional Requirements

### FR-1: Valid Transition Map

- A `VALID_TRANSITIONS` constant must enumerate every legal (from → to) pair
- Standard forward sequence: `unclaimed → planning → speccing → implementing → verifying → done`
- Permitted shortcut: `unclaimed → implementing` (for simple items that skip planning/speccing)
- No backward transitions are permitted
- No same-phase transitions are permitted (e.g., `planning → planning`)
- The `done` phase has no valid next phases

### FR-2: Transition Validation

- `validateTransition(from, to)` must return `{ valid: true }` for all entries in `VALID_TRANSITIONS`
- `validateTransition(from, to)` must return `{ valid: false, reason: string }` for all other combinations
- The `reason` string must identify both the `from` and `to` phases
- The function must not throw; it always returns a result object

### FR-3: Transition Action Generation

- `getTransitionActions(itemId, from, to)` returns a list of `TransitionAction` objects
- Each `TransitionAction` has: `path` (repo-relative), `content` (full file content), `create` (boolean)
- `unclaimed → planning`: creates `specs/<date>_feature_<slug>/README.md` with feature title and summary stub
- `planning → speccing`: creates `spec.md` and `requirements.md` with section stubs
- `speccing → implementing`: creates `tasks.md` with a stub implementation task list
- `implementing → verifying`: overwrites `tasks.md` to mark all checkboxes `[x]`
- `verifying → done`: produces an action for `ROADMAP.md` instructing the item be marked `[x]`
- `unclaimed → implementing`: creates both `README.md` and `tasks.md` in the spec dir
- Calling `getTransitionActions` for an invalid transition returns an empty array (validation is a separate concern)

### FR-4: TransitionService

- `TransitionService` must accept a `GitAdapter` in its constructor
- `executeTransition(itemId, from, to, branch?)` must:
  - Validate the transition using `validateTransition`; throw `InvalidTransitionError` if invalid
  - Obtain actions from `getTransitionActions`
  - Write each action via `adapter.writeFile` with commit message `transition: <itemId> <from>→<to>`
  - The `branch` parameter, when provided, is forwarded to `adapter.writeFile`
- `InvalidTransitionError` must be a named error class exported from `transition-service.ts`

### FR-5: POST /api/transitions

- Accepts `{ itemId, from, to, branch? }` in request body
- Returns 400 if any required field is missing or not a string
- Returns 400 if `from` or `to` are not valid `BoardPhase` values
- Returns 400 if the transition is invalid (wraps `InvalidTransitionError`)
- Returns 409 on `ConflictError` from the adapter
- Returns 200 on success

### FR-6: Commit Message Format

- Every file written during a transition must use the commit message: `transition: <itemId> <from>→<to>`
- This format is machine-parseable by future tooling
- The `→` character (U+2192) must be used, not `->` or `-->`

## Non-Functional Requirements

- `engine.ts` functions must be pure (no I/O, no side effects)
- `TransitionService` must not cache state between calls
- All commit messages must use the arrow character `→` (U+2192), not ASCII `->`
- The spec directory slug derived from `itemId` must use hyphens, not underscores or dots (e.g., `3.1.2` becomes `3-1-2`)
