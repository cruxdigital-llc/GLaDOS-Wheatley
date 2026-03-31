# Requirements: Worktree Isolation

## Goal

Wheatley must never modify the developer's working tree, index, or current branch when performing write operations (claims, transitions, activity logging). All writes must happen in an isolated git worktree.

## Success Criteria

1. **Developer's working tree is untouched**: Dirty files, staged changes, and the current branch are never affected by Wheatley writes
2. **Reads still work from the main repo**: Reading files, listing branches, and computing board state continue to work via `git show` / `git ls-tree` against the main repo — no dependency on worktree for reads
3. **Worktree lifecycle is automatic**: Created on server start, cleaned up on shutdown, recreated if missing
4. **Write operations still work**: Claims, transitions, and activity logging produce commits and push to origin, just from the worktree instead of the main checkout
5. **Concurrent write safety**: The existing write mutex continues to serialize operations within the worktree
6. **Fallback for environments without worktree support**: Bare repos, shallow clones, or old git versions get a clear error message at startup rather than cryptic failures mid-operation

## Current Problems

- `_writeFileImpl` calls `git checkout` on the developer's repo, which:
  - Fails if the working tree is dirty (current behavior: hard throw)
  - Would destroy uncommitted work if the dirty check were removed
  - Switches the developer's branch out from under them
- `git reset --hard` on push failure is a data-loss risk
- `readFile` without a ref reads from the working tree (filesystem), which returns the developer's in-progress edits rather than committed state

## Constraints

- Must work on Windows, macOS, and Linux
- Must work inside Docker containers (volume-mounted repos)
- simple-git library must support worktree operations (or we use raw git commands)
- The worktree path must not conflict with the developer's repo or other tooling
