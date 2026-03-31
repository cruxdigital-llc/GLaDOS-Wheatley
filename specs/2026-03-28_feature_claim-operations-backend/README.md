# Feature: Claim Operations Backend (2.2)

## Summary

This feature adds write support to Wheatley's git adapters and exposes two REST endpoints for claiming and releasing roadmap items. Claims are appended to `claims.md` on the configured coordination branch, with conflict detection to handle concurrent writes.

## Goals

- Extend `GitAdapter` with `writeFile(path, content, message, branch?)` so both local and remote adapters can commit files
- Implement write operations in `LocalGitAdapter` using simple-git (add, commit, push)
- Implement write operations in `RemoteGitAdapter` using Octokit's `createOrUpdateFileContents` API
- Expose `POST /api/claims` to claim a task (append a `[claimed]` entry, commit to coordination branch)
- Expose `DELETE /api/claims/:id` to release a claim (append a `[released]` entry, commit)
- Detect write conflicts (409 from API, push rejection from local git) and return a structured 409 response to the client
- Make the coordination branch configurable via `WHEATLEY_COORDINATION_BRANCH` (defaults to the adapter's default branch)

## Non-Goals

- UI for claiming/releasing (Phase 2.3)
- Cross-branch claim visibility (Phase 2.4)
- TTL / auto-expiry logic (Phase 5.2)
- Creating the `claims.md` file from scratch if it does not exist (the board starts with an empty file; if it is absent, we treat it as empty and create it)

## Design Decisions

- Claims are always written to the **coordination branch**, never to the branch the user is viewing
- Entries are appended (never replaced) — the parser uses last-entry-wins semantics
- Timestamps are UTC ISO 8601 (`new Date().toISOString()`)
- Conflict detection: if the remote returns 409, or if `git push` fails with a non-fast-forward error, the route returns `{ statusCode: 409, error: 'Conflict', message: '...' }`
- The `ClaimService` is the thin layer between routes and the adapter; it reads `claims.md`, validates the operation (e.g., item already claimed), builds the new entry, and delegates the write to the adapter

## Key Files

| File | Role |
|---|---|
| `src/server/git/types.ts` | `GitAdapter` interface (extended with `writeFile`) |
| `src/server/git/local-adapter.ts` | `LocalGitAdapter.writeFile` implementation |
| `src/server/git/remote-adapter.ts` | `RemoteGitAdapter.writeFile` implementation |
| `src/server/api/claim-service.ts` | Business logic for claim/release operations |
| `src/server/api/routes/claims.ts` | Route handlers for POST/DELETE |
| `src/server/api/server.ts` | Wire `claimsRoutes` into the app |
| `src/server/git/__tests__/local-adapter-write.test.ts` | Unit tests for local write |
| `src/server/git/__tests__/remote-adapter-write.test.ts` | Unit tests for remote write |
| `src/server/api/__tests__/claims-routes.test.ts` | Route integration tests |
