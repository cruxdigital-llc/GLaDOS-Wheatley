# Plan: Claim Operations Backend (2.2)

## Implementation Order

The work proceeds in dependency order: types first, then adapters, then service, then routes, then tests.

### Step 1: Extend GitAdapter interface (types.ts)

Add to `GitAdapter`:

```typescript
writeFile(path: string, content: string, message: string, branch?: string): Promise<void>;
```

Add a `ConflictError` class to `types.ts` so both adapters and callers can import the same type.

### Step 2: LocalGitAdapter.writeFile

Algorithm:
1. `git fetch origin <branch>` to bring remote up to date (best-effort; ignore errors)
2. `git checkout <branch>` — switch to coordination branch
3. Write the new file content to disk using `fs.writeFile`
4. `git add <path>`
5. `git commit -m <message>`
6. `git push origin <branch>`
7. If push fails with "non-fast-forward" or "rejected", throw `ConflictError`
8. If push fails for any other reason, throw standard `Error`

Note: The local adapter operates on a working-tree checkout. After the write, it returns the repo to whatever branch it was on before (checkout back). This is necessary because `getBoardState` reads from the working tree.

Actually, reconsidering — the coordination branch write should not disturb the working tree checkout. Instead, for local mode we use `git stash` or operate directly. The simplest safe approach: operate on the coordination branch in a separate git operation without permanently switching branches. We'll use `git worktree add` pattern or simply use a bare `git commit-tree` approach.

**Revised approach**: use `git stash` before checkout, do the write, push, then switch back and pop stash. If anything fails, ensure we restore the original branch. This is slightly fragile but workable for local dev mode.

**Even simpler**: accept that for local mode the adapter writes to the working tree directly on the coordination branch. In a Docker sidecar setup, the repo is mounted read-only for viewing and the coordination branch is the only writable branch. Document this constraint.

For the implementation, we will:
1. Remember current branch
2. `git checkout <branch>` (coordination branch)
3. Write file, add, commit, push
4. `git checkout <originalBranch>`

On error at any point, attempt to restore original branch.

### Step 3: RemoteGitAdapter.writeFile

Algorithm:
1. Try to read existing file SHA via `getContent`
2. Call `createOrUpdateFileContents` with base64 content and SHA (or no SHA if file is new)
3. Catch errors: `RequestError` with status 409 → throw `ConflictError`; all others → rethrow

### Step 4: ClaimService

New class `ClaimService` in `src/server/api/claim-service.ts`:

```typescript
constructor(adapter: GitAdapter, coordinationBranch?: string)
claimItem(itemId: string, claimant: string): Promise<ClaimEntry>
releaseItem(itemId: string, claimant?: string): Promise<ClaimEntry>
```

Internally:
- Resolves coordination branch (env var or `adapter.getDefaultBranch()`)
- Reads `claims.md` from coordination branch
- Parses with `parseClaims()`
- Validates business rules
- Builds new entry line
- Calls `adapter.writeFile('claims.md', newContent, message, branch)`

### Step 5: Claims Routes

New file `src/server/api/routes/claims.ts`:

```
POST /api/claims      body: { itemId, claimant }  → 201 ClaimEntry | 400 | 409
DELETE /api/claims/:id  ?claimant=  → 200 ClaimEntry | 404 | 409
```

Register in `server.ts`.

### Step 6: Tests

- `src/server/git/__tests__/local-adapter-write.test.ts` — integration tests using a real temp git repo
- `src/server/git/__tests__/remote-adapter-write.test.ts` — unit tests mocking Octokit
- `src/server/api/__tests__/claims-routes.test.ts` — route tests using a mock adapter

## File Change Summary

| File | Change |
|---|---|
| `src/server/git/types.ts` | Add `writeFile` to `GitAdapter`, add `ConflictError` class |
| `src/server/git/local-adapter.ts` | Implement `writeFile` |
| `src/server/git/remote-adapter.ts` | Implement `writeFile` |
| `src/server/git/index.ts` | Export `ConflictError` |
| `src/server/api/claim-service.ts` | New file |
| `src/server/api/routes/claims.ts` | New file |
| `src/server/api/server.ts` | Wire `claimsRoutes` |
| `src/server/api/index.ts` | Export `ClaimService` |
| `src/server/git/__tests__/local-adapter-write.test.ts` | New file |
| `src/server/git/__tests__/remote-adapter-write.test.ts` | New file |
| `src/server/api/__tests__/claims-routes.test.ts` | New file |
