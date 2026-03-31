# Plan: Phase Transition Engine (3.1)

## Implementation Order

Work proceeds in dependency order: shared types first, then pure engine logic, then the service that calls the adapter, then the route, then tests.

### Step 1: Transition types (src/shared/transitions/types.ts)

Define `VALID_TRANSITIONS` as a `Map<BoardPhase, BoardPhase[]>` with the complete set of legal forward moves:

```
unclaimed  → [planning, implementing]
planning   → [speccing]
speccing   → [implementing]
implementing → [verifying]
verifying  → [done]
done       → []
```

Define the `TransitionAction` type:

```typescript
export interface TransitionAction {
  /** Repo-relative file path to create or update */
  path: string;
  /** Full file content to write */
  content: string;
  /** Whether the file should be created anew (false = overwrite) */
  create: boolean;
}
```

### Step 2: Transition engine (src/shared/transitions/engine.ts)

Two pure functions:

**`validateTransition(from, to)`** — looks up `VALID_TRANSITIONS.get(from)`, checks if `to` is in the list. Returns `{ valid: true }` or `{ valid: false, reason: '...' }`. No throws; the caller decides what to do.

**`getTransitionActions(itemId, from, to)`** — returns a `TransitionAction[]` based on the (from, to) pair:

| Transition | Files |
|---|---|
| `unclaimed → planning` | create `specs/<date>_feature_<slug>/README.md` |
| `planning → speccing` | create `spec.md`, `requirements.md` in spec dir |
| `speccing → implementing` | create `tasks.md` in spec dir |
| `implementing → verifying` | overwrite `tasks.md` to mark all checkboxes `[x]` |
| `verifying → done` | overwrite `ROADMAP.md` item to `[x]` (content is a placeholder instruction) |
| `unclaimed → implementing` | create spec dir with `README.md` and `tasks.md` |

The spec directory path is derived from: `specs/<today>_feature_<itemId-as-slug>/`. Since the engine is pure, it does not read the filesystem; it generates content based on the itemId and transition.

### Step 3: TransitionService (src/server/api/transition-service.ts)

```typescript
export class TransitionService {
  constructor(adapter: GitAdapter)
  async executeTransition(itemId, from, to, branch?): Promise<void>
}
```

Algorithm for `executeTransition`:
1. Call `validateTransition(from, to)` — throw `InvalidTransitionError` if not valid
2. Call `getTransitionActions(itemId, from, to)` — get list of file changes
3. For each action, call `adapter.writeFile(action.path, action.content, commitMessage, branch)` where `commitMessage = 'transition: <itemId> <from>→<to>'`
4. If `adapter.writeFile` throws `ConflictError`, let it propagate (route handles 409)

### Step 4: Route (src/server/api/routes/transitions.ts)

```
POST /api/transitions
Body: { itemId: string, from: BoardPhase, to: BoardPhase, branch?: string }
→ 200 on success
→ 400 on invalid body or invalid transition
→ 409 on ConflictError
```

Register in `server.ts`.

### Step 5: Tests

- `src/shared/transitions/__tests__/engine.test.ts` — validation and action generation
- `src/server/api/__tests__/transitions-routes.test.ts` — route integration tests

## File Change Summary

| File | Change |
|---|---|
| `src/shared/transitions/types.ts` | New — `VALID_TRANSITIONS`, `TransitionAction` |
| `src/shared/transitions/engine.ts` | New — `validateTransition`, `getTransitionActions` |
| `src/server/api/transition-service.ts` | New — `TransitionService`, `InvalidTransitionError` |
| `src/server/api/routes/transitions.ts` | New — `POST /api/transitions` |
| `src/server/api/server.ts` | Updated — wire `TransitionService` and routes |
| `src/shared/transitions/__tests__/engine.test.ts` | New |
| `src/server/api/__tests__/transitions-routes.test.ts` | New |
