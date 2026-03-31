# Feature: Cross-Branch Claim Visibility (2.4)

## Summary

When viewing a non-coordination branch, the board must still display claims accurately.
This feature ensures claims are always read from the coordination branch regardless of
which branch is selected for viewing, adds a visual indicator when claims come from a
different branch than the one being viewed, and detects stale claims where no matching
spec activity exists on the viewed branch.

## Goals

- Always read `claims.md` from the coordination branch, even when viewing a feature branch
- Show a visual indicator on cards whose claims come from the coordination branch (not the viewed branch)
- Detect and flag claims as stale when no spec directory or active status task exists for the item on the viewed branch

## Non-Goals

- Merging or syncing claims between branches
- TTL / auto-expiry (Phase 5.2)
- Editing claims from the board UI (already covered by 2.3)

## Design Decisions

- `BoardService.getBoardState()` gains a `coordinationBranch` parameter; roadmap/specs/status are read from the viewed branch, but `claims.md` is always read from the coordination branch
- `BoardCard` gains an optional `stale?: boolean` field set by the assembler
- A claim is stale when: the card has an active claim AND has neither a `specEntry` nor a matching `statusTask` on the viewed branch
- The coordination branch indicator is rendered in `Card.tsx` as a subtle badge; it appears whenever the viewed branch differs from the coordination branch and the card has an active claim
- Staleness is a data-layer concern (assembler); cross-branch origin is a presentation concern (Card props)

## Key Files

| File | Role |
|---|---|
| `src/shared/grammar/types.ts` | Add `stale?: boolean` to `BoardCard` |
| `src/shared/parsers/board-assembler.ts` | Compute stale flag after claim attachment |
| `src/server/api/board-service.ts` | Accept `coordinationBranch`, read claims from it |
| `src/server/api/routes/board.ts` | Pass coordination branch from query / ClaimService |
| `src/server/api/server.ts` | Wire `BoardService` with access to coordination branch |
| `src/client/components/Card.tsx` | Render cross-branch indicator and stale warning |
| `src/server/api/__tests__/board-service.test.ts` | Tests for cross-branch claim reading |
| `src/shared/parsers/board-assembler.test.ts` | Tests for stale claim detection |
