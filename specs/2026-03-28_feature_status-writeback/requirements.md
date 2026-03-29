# Requirements: Status Writeback (3.4)

## Functional Requirements

### FR-1 — Update PROJECT_STATUS.md on transition
After a successful phase transition, `TransitionService.executeTransition` writes
an updated `PROJECT_STATUS.md` via the adapter.

### FR-2 — Section movement logic
- Transitioning out of `unclaimed` into any active phase: task moves from
  backlog to the current focus section (or is added if not present).
- Transitioning to `done`: task is marked `[x]` in PROJECT_STATUS.md.
- All writes use the existing commit message format:
  `transition: <itemId> <from>→<to>`.

### FR-3 — Spec directory creation on planning entry
When an item transitions to `planning`, a spec directory is created
(already handled by `getTransitionActions`). This requirement confirms the
spec directory README template is created correctly.

### FR-4 — Commit message convention (audit trail)
All transition commits use: `transition: <itemId> <from>→<to>` (U+2192 arrow).
This is already enforced in 3.1; confirmed here that writeback commits use the
same format.

### FR-5 — Tests for status writeback
Unit tests cover:
- `buildStatusWriteback` for a task moving to active focus
- `buildStatusWriteback` for a task marked done
- Integration: TransitionService calls adapter with updated PROJECT_STATUS.md
