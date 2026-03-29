# Spec: Status Writeback (3.4)

## 1. Overview

`TransitionService.executeTransition` is extended to read the current
`PROJECT_STATUS.md`, apply a writeback transformation, and write the updated
file back. The transformation is a pure function: `buildStatusWriteback`.

## 2. New files

| File | Purpose |
|---|---|
| `src/server/api/status-writeback.ts` | Pure `buildStatusWriteback` function |
| `src/server/api/__tests__/status-writeback.test.ts` | Unit tests |

## 3. Modified files

| File | Change |
|---|---|
| `src/server/api/transition-service.ts` | Read PROJECT_STATUS.md, call buildStatusWriteback, write result |

## 4. `buildStatusWriteback` signature

```ts
export function buildStatusWriteback(
  currentContent: string,
  itemId: string,
  title: string,
  from: BoardPhase,
  to: BoardPhase,
): string
```

Returns the updated PROJECT_STATUS.md content as a string. If the file is
empty or malformed, returns the input unchanged (fail-safe).

## 5. Writeback logic

### Transition to active phase (unclaimed → planning/implementing/speccing)
If a task line matching `itemId` exists in the backlog section, move it to the
first focus section. If the task does not exist anywhere, add it to the first
focus section with checkbox `[ ]`.

### Transition to done (verifying → done)
Find the task line matching `itemId` in the status file and set its checkbox
to `[x]`.

### Other transitions
Update the checkbox state of the matching line to `[ ]` (still in-progress).

## 6. Line matching

The status parser uses `**<label>**: <description>` format. The label is
matched against `itemId` (case-insensitive prefix match).
