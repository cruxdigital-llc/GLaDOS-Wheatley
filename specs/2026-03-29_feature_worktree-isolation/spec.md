# Spec: Worktree Isolation

## Data Model Changes

None. This is a git-layer refactor — no new API endpoints, no schema changes.

## Architecture

### New: WorktreeManager (`src/server/git/worktree-manager.ts`)

```typescript
export interface WorktreeManagerOptions {
  repoPath: string;                  // Main repo path
  worktreePath?: string;             // Override path (default: {repoPath}/.wheatley-worktree)
}

export class WorktreeManager {
  private worktreePath: string;
  private worktreeGit: SimpleGit | null = null;
  private ready: boolean = false;

  constructor(options: WorktreeManagerOptions);

  /** Create the worktree. Reuses existing if found. Idempotent. */
  async init(): Promise<void>;

  /** Returns true if worktree is initialized and usable */
  isReady(): boolean;

  /** Get the filesystem path of the worktree */
  getPath(): string;

  /** Get a simple-git instance pointed at the worktree */
  getGit(): SimpleGit;

  /** Remove the worktree cleanly */
  async destroy(): Promise<void>;
}
```

**init() logic**:
1. Check if `worktreePath` already exists on disk (stale from previous run)
   - If yes: run `git worktree remove --force {path}` first, then re-add
2. Run `git worktree add {worktreePath} {defaultBranch}` from the main repo
3. Configure git user in worktree (copy from main repo config)
4. Set `this.worktreeGit = simpleGit(worktreePath)`
5. Set `this.ready = true`

**destroy() logic**:
1. If not ready, return
2. Run `git worktree remove --force {worktreePath}` from main repo
3. Set `this.ready = false`, `this.worktreeGit = null`

### Modified: LocalGitAdapter

**Constructor change**:
```typescript
constructor(repoPath: string, worktreeManager?: WorktreeManager)
```

**New field**: `private worktreeManager: WorktreeManager | null`

**Read methods** (`readFile`, `listDirectory`):
- When no ref is provided, change to read from `HEAD` instead of the filesystem
- `readFile(path)` → `this.git.show(['HEAD:' + path])` instead of `fs.readFile`
- `listDirectory(path)` → `this.listFromGit(path, 'HEAD')` instead of `this.listFromFilesystem`
- This ensures reads return committed content, not developer's dirty edits
- Keep `listFromFilesystem` as a private method (may be useful for worktree writes)

**_writeFileImpl rewrite** (when worktreeManager is present):
```
1. worktreeGit.fetch('origin')
2. worktreeGit.checkout(targetBranch)
3. worktreeGit.reset(['--hard', `origin/${targetBranch}`])
4. Write file to worktree filesystem (using worktreeManager.getPath())
5. worktreeGit.add(path)
6. worktreeGit.commit(message)
7. worktreeGit.push('origin', targetBranch)
   - On non-fast-forward: retry up to 2 more times with fetch+reset before each retry
   - On final failure: throw ConflictError (no reset --hard on main repo)
```

**_writeFileImpl fallback** (when no worktreeManager):
- Keep current behavior with the dirty-tree check
- Log a warning on first use: "Running without worktree isolation — writes require clean working tree"

**safePath change**:
- New method `safeWorktreePath(path)` that resolves against worktree path instead of repo path
- Existing `safePath()` unchanged (used for main repo reads if needed)

### Modified: factory.ts

```typescript
export function createGitAdapter(config: GitAdapterConfig): { adapter: GitAdapter; worktreeManager?: WorktreeManager } {
  // local mode: create WorktreeManager, pass to LocalGitAdapter
  // remote mode: no change
}
```

Wait — changing the factory return type is a breaking change. Better approach: the factory stays returning `GitAdapter`, and the server creates the WorktreeManager itself and passes it in.

### Modified: server.ts

```typescript
// On startup (local mode):
const worktreeManager = new WorktreeManager({ repoPath: config.localPath });
await worktreeManager.init();
const adapter = new LocalGitAdapter(config.localPath, worktreeManager);

// On shutdown:
await worktreeManager.destroy();
```

## Edge Cases

1. **Worktree path already exists (stale)**: `init()` removes and re-creates
2. **Git worktree not supported**: `init()` catches the error, logs warning, returns without setting ready
3. **Server killed without shutdown**: Next `init()` detects stale worktree and cleans up
4. **Worktree becomes corrupt**: `ensureReady()` check before each write, re-init if needed
5. **Multiple Wheatley instances**: Each gets its own worktree path (uuid suffix or PID-based)
6. **Repo has no remote**: Push step skipped (local-only mode for testing)

## .gitignore

Add `.wheatley-worktree/` to `.gitignore` template to prevent accidental commits.

## Testing Strategy

- **Unit tests for WorktreeManager**: init/destroy lifecycle, stale cleanup, fallback on failure
- **Integration tests for LocalGitAdapter with worktree**: write file, concurrent conflict, path traversal
- **Regression**: Existing write tests should pass with worktree mode
- **Edge case**: Write while main repo is dirty (should succeed with worktree, fail without)
