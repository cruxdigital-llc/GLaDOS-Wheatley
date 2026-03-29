# Feature: Drag-and-Drop UI (3.2)

## Summary

Native HTML5 drag-and-drop support for the Kanban board, allowing cards to be
moved between phase columns directly in the UI. Uses the browser's built-in
`draggable` attribute and `ondragstart`/`ondragover`/`ondrop` events — no
third-party library.

## Goals

- Cards are draggable with a visible drag handle
- Columns highlight when a card is hovered over them as a valid drop target
- Invalid drop targets (phases not reachable from the card's current phase) are
  greyed out and reject drops
- Optimistic UI: the card moves instantly; if the server rejects the transition
  the board rolls back and shows an error
- A confirmation dialog is shown before any transition that will create files
  (unclaimed → planning, planning → speccing, etc.)

## Non-Goals

- Touch / mobile drag support (HTML5 DnD does not work on touch screens)
- Reordering cards within a column
