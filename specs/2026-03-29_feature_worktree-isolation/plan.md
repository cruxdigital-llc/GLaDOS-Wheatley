# Plan: Worktree Isolation

## Approach

### 1. Create a WorktreeManager class

New class `src/server/git/worktree-manager.ts` that manages the lifecycle of a dedicated Wheatley worktree:

- `init()`: Creates a worktree at `{repoPath}/.wheatley-worktree/` (or configurable via env `WHEATLEY_WORKTREE_PATH`) checked out to the default branch
- `getPath()`: Returns the worktree filesystem path
- `getGit()`: Returns a simple-git instance pointed at the worktree
- `destroy()`: Removes the worktree via `git worktree remove`
- `ensureReady()`: Checks worktree exists, recreates if missing
- Startup detection: if worktree already exists from a previous unclean shutdown, reuse it

### 2. Refactor LocalGitAdapter to use two git instances

- `this.git` — points to the **main repo** (read-only operations: readFile, listDirectory, listBranches, etc.)
- `this.worktreeGit` — points to the **worktree** (write operations: checkout, add, commit, push)
- Constructor accepts an optional `WorktreeManager` instance
- If no worktree manager provided (tests, fallback), behavior degrades to current single-repo mode with a warning

### 3. Rewrite _writeFileImpl to use the worktree

Instead of:
1. Check main repo is clean → FAIL if dirty
2. Checkout target branch in main repo
3. Write file to main repo working tree
4. Add, commit, push from main repo
5. Checkout original branch back

New flow:
1. Pull latest in worktree: `git fetch origin && git reset --hard origin/{targetBranch}`
2. Checkout target branch in worktree (already isolated — no dirty check needed)
3. Write file to worktree filesystem
4. Add, commit, push from worktree
5. No branch restore needed (worktree has its own HEAD)

### 4. Fix reads to always use git refs, not working tree

- `readFile(path)` without a ref currently reads from filesystem → change to use `git show HEAD:{path}` so it reads committed state, not developer's in-progress edits
- `listDirectory(path)` without a ref currently reads from filesystem → change to use `git ls-tree HEAD {path}`
- This means reads are always consistent regardless of dirty state

### 5. Worktree lifecycle in server.ts

- On server start: `worktreeManager.init()`
- On server shutdown (SIGTERM/SIGINT): `worktreeManager.destroy()`
- Pass worktree manager to LocalGitAdapter constructor
- Add startup validation: check `git worktree list` works, log warning if git version is too old

### 6. Fallback for unsupported environments

- If `git worktree add` fails (bare repo, old git, permission issue):
  - Log a clear warning
  - Fall back to current behavior (single-repo writes, require clean tree)
  - Set a flag so the UI can show "writes require clean working tree" warning

## Files to Create/Modify

- **New**: `src/server/git/worktree-manager.ts`
- **New**: `src/server/git/__tests__/worktree-manager.test.ts`
- **Modify**: `src/server/git/local-adapter.ts` (dual git instances, rewrite _writeFileImpl, fix reads)
- **Modify**: `src/server/git/local-adapter.test.ts` (update tests for worktree behavior)
- **Modify**: `src/server/api/server.ts` (worktree lifecycle on start/shutdown)
- **Modify**: `src/server/git/factory.ts` (create worktree manager, pass to adapter)

## Risk Mitigation

- **Race condition**: Write mutex already serializes — worktree doesn't change this
- **Disk space**: Worktree is a lightweight checkout (shares .git objects), minimal overhead
- **Docker**: Worktree path must be within the mounted volume; default `.wheatley-worktree/` inside the repo ensures this
- **Windows**: `git worktree` works on Windows; path separator handling via `path.resolve()`
