# Spec: Phase Transition Engine (3.1)

## 1. Transition Types (src/shared/transitions/types.ts)

### 1.1 VALID_TRANSITIONS

```typescript
export const VALID_TRANSITIONS: Map<BoardPhase, BoardPhase[]> = new Map([
  ['unclaimed',     ['planning', 'implementing']],
  ['planning',      ['speccing']],
  ['speccing',      ['implementing']],
  ['implementing',  ['verifying']],
  ['verifying',     ['done']],
  ['done',          []],
]);
```

### 1.2 TransitionAction

```typescript
export interface TransitionAction {
  /** Repo-relative path of the file to write */
  path: string;
  /** Full file content — the adapter writes this verbatim */
  content: string;
  /** True if this is a new file, false if overwriting an existing file */
  create: boolean;
}
```

## 2. Transition Engine (src/shared/transitions/engine.ts)

### 2.1 validateTransition

```typescript
export function validateTransition(
  from: BoardPhase,
  to: BoardPhase,
): { valid: boolean; reason?: string }
```

Algorithm:
1. Look up `VALID_TRANSITIONS.get(from)`
2. If `to` is in the array, return `{ valid: true }`
3. Otherwise return `{ valid: false, reason: \`Invalid transition: ${from} → ${to}\` }`

### 2.2 getTransitionActions

```typescript
export function getTransitionActions(
  itemId: string,
  from: BoardPhase,
  to: BoardPhase,
): TransitionAction[]
```

The spec directory path is computed as:
```
specs/<today>_feature_<slug>/
```
where `<slug>` is `itemId` with dots replaced by hyphens (e.g., `3.1.2` → `3-1-2`), and `<today>` is the current date in `YYYY-MM-DD` format.

#### 2.2.1 unclaimed → planning

Returns one action:

```
path:    specs/<date>_feature_<slug>/README.md
create:  true
content: (see template below)
```

README.md template:
```markdown
# Feature: <itemId>

## Summary

_TODO: Describe what this feature does._

## Goals

- TODO

## Non-Goals

- TODO
```

#### 2.2.2 planning → speccing

Returns two actions:

**spec.md** (create: true):
```markdown
# Spec: <itemId>

## 1. Overview

_TODO: Describe the technical design._
```

**requirements.md** (create: true):
```markdown
# Requirements: <itemId>

## Functional Requirements

### FR-1

- TODO
```

#### 2.2.3 speccing → implementing

Returns one action:

**tasks.md** (create: true):
```markdown
# Tasks: <itemId>

## Implementation Tasks

- [ ] **TODO**: Describe first task
```

#### 2.2.4 implementing → verifying

Returns one action:

**tasks.md** (create: false — overwrite):
```markdown
# Tasks: <itemId>

## Implementation Tasks

- [x] All implementation tasks completed
```

#### 2.2.5 verifying → done

Returns one action:

```
path:    ROADMAP.md
create:  false
content: (marker string — see below)
```

The content is a special sentinel string that signals to the ROADMAP.md parser (or a human) that item `<itemId>` should be marked `[x]`. Because the engine does not read the actual ROADMAP.md, it produces:

```
MARK_DONE:<itemId>
```

The `TransitionService` or a future parser can interpret this marker. For now, it writes this sentinel to ROADMAP.md so the transition is recorded in git history.

#### 2.2.6 unclaimed → implementing

Returns two actions (README.md + tasks.md), same content as if `unclaimed → planning` and then `speccing → implementing` were executed in sequence, but in a single transition.

#### 2.2.7 Invalid transitions

Returns an empty array `[]`.

## 3. TransitionService (src/server/api/transition-service.ts)

### 3.1 InvalidTransitionError

```typescript
export class InvalidTransitionError extends Error {
  constructor(from: BoardPhase, to: BoardPhase, reason: string) {
    super(reason);
    this.name = 'InvalidTransitionError';
    this.from = from;
    this.to = to;
  }
  readonly from: BoardPhase;
  readonly to: BoardPhase;
}
```

### 3.2 TransitionService

```typescript
export class TransitionService {
  constructor(private readonly adapter: GitAdapter) {}

  async executeTransition(
    itemId: string,
    from: BoardPhase,
    to: BoardPhase,
    branch?: string,
  ): Promise<void>
}
```

Algorithm for `executeTransition`:
1. `const result = validateTransition(from, to)`
2. If `!result.valid` → throw `new InvalidTransitionError(from, to, result.reason!)`
3. `const actions = getTransitionActions(itemId, from, to)`
4. `const message = \`transition: ${itemId} ${from}→${to}\``
5. For each `action` in `actions`:
   - `await this.adapter.writeFile(action.path, action.content, message, branch)`

`ConflictError` from the adapter is not caught here; it propagates to the route.

## 4. Route (src/server/api/routes/transitions.ts)

### 4.1 POST /api/transitions

**Request body:**
```typescript
{
  itemId: string;   // e.g., "3.1.2"
  from: BoardPhase; // current phase
  to: BoardPhase;   // desired phase
  branch?: string;  // optional target branch
}
```

**Response table:**

| Status | Body | When |
|---|---|---|
| 200 | `{}` | Transition executed successfully |
| 400 | `ApiError` | Missing/invalid fields, or invalid transition |
| 409 | `{ statusCode: 409, error: 'Conflict', message: '...', conflict: true }` | Git write conflict |
| 500 | `ApiError` | Unexpected error |

### 4.2 Validation

The route validates:
- `itemId` is a non-empty string
- `from` and `to` are both valid `BoardPhase` values (present in `PHASE_ORDER`)
- `branch`, if present, is a string

Invalid body → 400 before calling the service.

## 5. Server Wiring

In `server.ts`:

```typescript
import { TransitionService } from './transition-service.js';
import { transitionRoutes } from './routes/transitions.js';

// In createServer:
const transitionService = new TransitionService(options.adapter);
transitionRoutes(app, transitionService);
```
