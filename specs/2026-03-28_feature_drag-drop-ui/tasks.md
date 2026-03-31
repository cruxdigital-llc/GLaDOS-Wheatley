# Tasks: Drag-and-Drop UI (3.2)

## Implementation Tasks

- [x] **3.2.1 Drag-and-drop library integration**: Use native HTML5 DnD — add `draggable="true"` and `onDragStart` to Card
- [x] **3.2.2 Drop zone validation**: Column `onDragOver` checks VALID_TRANSITIONS; highlights valid targets, dims invalid ones
- [x] **3.2.3 Optimistic UI update with rollback**: Board lifts drag state; on drop, optimistically moves card in local state then calls API; reverts on failure
- [x] **3.2.4 Confirmation dialog for transitions that create files**: ConfirmTransitionModal shown before file-creating transitions
- [x] **Add executeTransition to api.ts**: POST /api/transitions wrapper
- [x] **Add use-transitions.ts hook**: React Query mutation wrapping executeTransition
