# Tasks: Claim Operations Backend (2.2)

## Implementation Tasks

- [x] **2.2.1 Extend GitAdapter interface**: Add `writeFile(path, content, message, branch?)` to `GitAdapter` in `src/server/git/types.ts`; add `ConflictError` class; export from `src/server/git/index.ts`
- [x] **2.2.2 LocalGitAdapter write**: Implement `writeFile` in `src/server/git/local-adapter.ts` using simple-git (checkout branch, write file, add, commit, push; detect non-fast-forward → ConflictError; restore original branch on error)
- [x] **2.2.3 RemoteGitAdapter write**: Implement `writeFile` in `src/server/git/remote-adapter.ts` using `octokit.repos.createOrUpdateFileContents`; read current SHA first; catch 409 → ConflictError
- [x] **2.2.4 POST /api/claims route**: Implement in `src/server/api/routes/claims.ts`; validate body; delegate to `ClaimService.claimItem`; return 201 on success, 400/409 on error
- [x] **2.2.5 DELETE /api/claims/:id route**: Implement in same file; delegate to `ClaimService.releaseItem`; return 200 on success, 404/403/409 on error
- [x] **2.2.6 Conflict detection**: ConflictError thrown by adapters is caught in route handlers and translated to 409 response with `{ conflict: true }`
- [x] **2.2.7 Coordination branch config**: `ClaimService.getCoordinationBranch()` reads `WHEATLEY_COORDINATION_BRANCH` env var, falls back to `adapter.getDefaultBranch()`
- [x] **ClaimService**: Create `src/server/api/claim-service.ts` with `claimItem` and `releaseItem` logic; includes `AlreadyClaimedError`, `NotClaimedError`, `ForbiddenError`
- [x] **Wire routes**: Register `claimsRoutes` in `src/server/api/server.ts`; export `ClaimService` from `src/server/api/index.ts`

## Test Tasks

- [x] **Unit tests: LocalGitAdapter.writeFile**: Create `src/server/git/__tests__/local-adapter-write.test.ts` — uses a real temp git repo with a bare remote; tests: successful write+push, conflict detection (push rejection), branch restoration on error, path traversal rejection
- [x] **Unit tests: RemoteGitAdapter.writeFile**: Create `src/server/git/__tests__/remote-adapter-write.test.ts` — mocks Octokit; tests: create new file (no SHA), update existing file (with SHA), 409 → ConflictError, other errors rethrown
- [x] **Route tests: POST /api/claims**: Create `src/server/api/__tests__/claims-routes.test.ts` — tests: 201 on success, 400 invalid itemId, 400 invalid claimant, 409 already claimed, 409 write conflict
- [x] **Route tests: DELETE /api/claims/:id**: In same file — tests: 200 on success, 404 not claimed, 403 wrong claimant, 409 write conflict

## Verification Checklist

Before marking this feature done, verify:

- [x] `GET /api/board` still returns 200 (no regressions)
- [x] `POST /api/claims` returns 201 with correct `ClaimEntry` shape
- [x] `DELETE /api/claims/:id` returns 200 with correct `ClaimEntry` shape
- [x] Conflict path returns 409 with `{ conflict: true }` in body
- [x] `WHEATLEY_COORDINATION_BRANCH` env var is respected when set
- [x] All new tests are present and structured consistently with existing test files
