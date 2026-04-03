# Spec: Docker Git Auth

## 1. Push Gate in Local Adapter

### 1.1 Configuration

New env var: `WHEATLEY_PUSH_ON_WRITE`
- Values: `"true"` | `"false"` | unset
- Default when unset: `false` for `WHEATLEY_MODE=local`, `true` for `WHEATLEY_MODE=cloud`
- Read once at adapter construction time, stored as `private readonly pushOnWrite: boolean`

**`src/server/git/local-adapter.ts` constructor changes:**
```
const mode = process.env['WHEATLEY_MODE'] ?? 'local';
const pushEnv = process.env['WHEATLEY_PUSH_ON_WRITE'];
this.pushOnWrite = pushEnv !== undefined
  ? pushEnv === 'true'
  : mode === 'cloud';
```

### 1.2 _writeViaWorktree Changes (lines 163–213)

**Current flow:** fetch → checkout → write → commit → push (with retry)

**New flow when `pushOnWrite=false`:**
1. Skip `wt.fetch('origin')` (line 173) — no network calls
2. Checkout the LOCAL branch tip instead of `origin/{branch}`:
   - `await wt.raw(['checkout', targetBranch])` (not `origin/targetBranch`)
   - If detached HEAD, use `git rev-parse refs/heads/{branch}` to get local tip
3. Write file → stage → commit (unchanged)
4. **Skip the push retry loop entirely** (lines 185–212)
5. Update local branch ref to point to new commit:
   - `await this.git.raw(['update-ref', 'refs/heads/{branch}', commitSha])`
   - Get commitSha from `wt.revparse(['HEAD'])` after commit

**New flow when `pushOnWrite=true`:**
- Existing behavior unchanged (fetch → checkout origin tip → commit → push with retry)

### 1.3 _writeViaMainRepo Changes (lines 313–359)

Same pattern: gate the `this.git.push('origin', targetBranch)` call at line 339 behind `this.pushOnWrite`. When false, commit succeeds and local branch advances; no push.

### 1.4 Delete Operations

`_deleteViaWorktree` (lines 215–270) and `_deleteViaMainRepo` (lines 361–400) also push. Same gate applied.

## 2. Credential Configuration

### 2.1 When Push Is Enabled

**`src/server/git/worktree-manager.ts`** — new method `configureCredentials()` called from `_doInit()` after `copyUserConfig()`, only when `pushOnWrite=true`.

```typescript
private async configureCredentials(): Promise<void> {
  if (!this.worktreeGit) return;

  // Detect remote URL protocol
  const remoteUrl = await this.mainGit.remote(['get-url', 'origin']).catch(() => '');
  const isSSH = remoteUrl.startsWith('git@') || remoteUrl.startsWith('ssh://');

  if (isSSH) {
    // SSH: no credential helper needed, keys must be mounted via Docker volume
    return;
  }

  // HTTPS: configure credential helper from env vars
  const token = process.env['GITHUB_TOKEN'] || process.env['GITLAB_TOKEN'];
  const credUrl = process.env['GIT_CREDENTIALS_URL'];

  if (token) {
    // Extract host from remote URL
    const host = new URL(remoteUrl).hostname; // e.g., github.com
    const credLine = `https://x-access-token:${token}@${host}`;
    await writeFile('/root/.git-credentials', credLine + '\n', 'utf-8');
    await this.worktreeGit.addConfig('credential.helper', 'store');
  } else if (credUrl) {
    await writeFile('/root/.git-credentials', credUrl + '\n', 'utf-8');
    await this.worktreeGit.addConfig('credential.helper', 'store');
  }
  // If no credentials available and push is enabled, pushes will fail
  // with a clear error message (see section 5)
}
```

### 2.2 Constructor Changes

`WorktreeManager` needs to know `pushOnWrite` to decide whether to configure credentials:
```typescript
constructor(options: WorktreeManagerOptions & { pushOnWrite?: boolean })
```

### 2.3 GPG Detection

In `_doInit()`, after credential setup:
```typescript
private async detectGPGRequirement(): Promise<void> {
  try {
    const gpgSign = await this.mainGit.raw(['config', 'commit.gpgsign']).catch(() => '');
    if (gpgSign.trim() === 'true') {
      // Check if GPG is available
      const gpgAvailable = await exec('gpg --version').then(() => true).catch(() => false);
      if (!gpgAvailable) {
        this.gpgWarning = 'Repository requires GPG signing but gpg is not available in the container.';
      } else {
        await this.worktreeGit!.addConfig('commit.gpgsign', 'true');
      }
    }
  } catch { /* no gpg config */ }
}
```

Expose via `get gpgWarning(): string | undefined`.

## 3. Unpushed Commit Tracking

### 3.1 RepoStatus Extension

**`src/server/git/types.ts`** — extend `RepoStatus`:
```typescript
export interface RepoStatus {
  // ... existing fields ...
  pushOnWrite: boolean;        // Whether auto-push is enabled
  unpushedCommits: number;     // Commits in worktree ahead of origin (0 when pushOnWrite=true)
  gpgWarning?: string;         // Warning if GPG signing required but unavailable
}
```

### 3.2 Implementation in Local Adapter

**`getRepoStatus()` in local-adapter.ts** — add after existing status fields:
```typescript
// Count unpushed commits (worktree branch ahead of origin)
let unpushedCommits = 0;
if (!this.pushOnWrite && this.worktreeManager?.isReady()) {
  try {
    const wt = this.worktreeManager.getGit();
    const branch = await this.getDefaultBranch();
    const log = await wt.log([`origin/${branch}..HEAD`]).catch(() => null);
    unpushedCommits = log?.total ?? 0;
  } catch { /* origin ref may not exist yet */ }
}
```

## 4. Push API Endpoint

### 4.1 New Route

**`src/server/api/routes/repo-status.ts`** — add `POST /api/repo/push`:

```typescript
app.post('/api/repo/push', async (request, reply) => {
  if (!adapter.push) {
    return reply.status(501).send({ error: 'Push not supported for this adapter' });
  }
  try {
    const result = await adapter.push();
    return reply.status(200).send(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Push failed';
    // Enhance error message for credential issues
    if (message.includes('could not read Username') || message.includes('Authentication failed')) {
      return reply.status(401).send({
        error: 'Push failed: no git credentials configured.',
        hint: 'Set GITHUB_TOKEN environment variable or mount SSH keys via Docker volume.',
      });
    }
    return reply.status(500).send({ error: message });
  }
});
```

### 4.2 GitAdapter Interface Extension

**`src/server/git/types.ts`**:
```typescript
export interface GitAdapter {
  // ... existing methods ...
  /** Push unpushed worktree commits to origin. Only available for local adapter. */
  push?(): Promise<{ pushed: boolean; commits: number }>;
}
```

### 4.3 Local Adapter push() Implementation

Extract the push + retry logic from `_writeViaWorktree` into a reusable `push()` method:
```typescript
async push(): Promise<{ pushed: boolean; commits: number }> {
  const wt = this.worktreeManager!.getGit();
  const branch = await this.getDefaultBranch();

  // Count commits to push
  const log = await wt.log([`origin/${branch}..HEAD`]).catch(() => null);
  const count = log?.total ?? 0;
  if (count === 0) return { pushed: false, commits: 0 };

  // Fetch latest, rebase if needed, push
  await wt.fetch('origin');
  await wt.raw(['push', 'origin', `HEAD:${branch}`]);
  await this.git.fetch('origin').catch(() => {});

  return { pushed: true, commits: count };
}
```

## 5. UI Changes

### 5.1 RepoStatusIndicator Enhancement

**`src/client/components/RepoStatusIndicator.tsx`**

When `status.unpushedCommits > 0`:
- Show in the existing status bar: amber dot + "{N} unpushed commit(s)"
- Add a "Push" button next to it
- Push button calls `POST /api/repo/push`
- On success: invalidate repo status query, show brief success toast
- On error: show error with hint from server response

When `status.pushOnWrite === true`:
- Don't show push button (pushes happen automatically)

When `status.gpgWarning`:
- Show warning icon with tooltip: "GPG signing required but not configured"

### 5.2 Client API

**`src/client/api.ts`** — add:
```typescript
export async function pushToOrigin(): Promise<{ pushed: boolean; commits: number }> {
  return fetchJson(`${API_BASE}/repo/push`, { method: 'POST' });
}
```

## 6. Docker Compose Documentation

**`docker-compose.yml`** — add comments to the server service:
```yaml
environment:
  - WHEATLEY_MODE=${WHEATLEY_MODE:-local}
  - WHEATLEY_REPO_PATH=/repo
  # Push behavior: local mode defaults to commit-only (no push).
  # Set to 'true' to push on every write (requires credentials below).
  # - WHEATLEY_PUSH_ON_WRITE=false
  #
  # For pushing to GitHub/GitLab, provide a token:
  # - GITHUB_TOKEN=${GITHUB_TOKEN}
  # - GITLAB_TOKEN=${GITLAB_TOKEN}
volumes:
  - ${REPO_PATH:-.}:/repo
  # For SSH-based remotes, mount your SSH keys:
  # - ~/.ssh:/root/.ssh:ro
  # For GPG signing, mount the GPG agent:
  # - ${GNUPGHOME:-~/.gnupg}:/root/.gnupg:ro
```

## 7. Edge Cases

| Scenario | Behavior |
|----------|----------|
| Local mode, no origin remote at all | Commits succeed, push button disabled, no "unpushed" count |
| Local mode, origin exists but unreachable | Commits succeed locally, push button shows error on click |
| Cloud mode, credentials missing | Push fails with clear error (same as today but better message) |
| Switch from local to cloud mode | Restart required; existing unpushed commits pushed on first write |
| Multiple concurrent writes in no-push mode | Write lock serializes; each commit advances branch linearly |
| Worktree not initialized (fallback to _writeViaMainRepo) | Same push gate applies; local-only commits work |
| GPG required, key not available | Commit fails with clear message, card transition rolls back |

## 8. Files Modified

| File | Change |
|------|--------|
| `src/server/git/local-adapter.ts` | `pushOnWrite` flag, gate pushes in all 4 write/delete methods, `push()` method, `getRepoStatus()` extension |
| `src/server/git/worktree-manager.ts` | `configureCredentials()`, `detectGPGRequirement()`, accept `pushOnWrite` option |
| `src/server/git/types.ts` | `RepoStatus` extension (unpushedCommits, pushOnWrite, gpgWarning), `push()` on GitAdapter |
| `src/server/api/routes/repo-status.ts` | `POST /api/repo/push` endpoint |
| `src/client/components/RepoStatusIndicator.tsx` | Unpushed count, Push button, GPG warning |
| `src/client/api.ts` | `pushToOrigin()` function |
| `docker-compose.yml` | Documentation comments |
