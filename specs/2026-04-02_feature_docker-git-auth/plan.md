# Plan: Docker Git Auth

## Overview

Wheatley's local git adapter currently pushes to origin on every write. This fails in Docker (no credentials) and is unexpected behavior for local development. The fix: local mode commits only, cloud mode pushes. Credentials and signing configured when push is enabled.

## Approach

### Core Change: Split Commit and Push

The local adapter's `_writeViaWorktree` currently does fetch → checkout → write → commit → push as one atomic operation. We split this into:

1. **Commit path** (always): checkout branch tip → write file → stage → commit
2. **Push path** (conditional): push to origin, retry on conflict

The push path is gated by a `pushOnWrite` flag derived from mode + env var.

### Architecture

```
WHEATLEY_MODE=local (default)        WHEATLEY_MODE=cloud
        │                                    │
        ▼                                    ▼
  pushOnWrite=false                   pushOnWrite=true
        │                                    │
        ▼                                    ▼
  commit to worktree                  commit + push to origin
  update local refs                   update local refs
        │                                    │
        ▼                                    ▼
  UI: "3 unpushed commits"           UI: (current behavior)
  [Push] button available            no push button needed
```

Override: `WHEATLEY_PUSH_ON_WRITE=true|false` overrides the mode default.

## Work Breakdown

### WB-1: Add Push Gate to Local Adapter
**`src/server/git/local-adapter.ts`**
- Read `WHEATLEY_PUSH_ON_WRITE` env var, default based on mode
- In `_writeViaWorktree`: after commit, check `pushOnWrite` flag
- If false: update local refs to reflect the commit (so reads work) but skip push
- If true: push as before (existing retry logic)
- Same change in `_writeViaDirect` path

### WB-2: Credential Helper Configuration
**`src/server/git/worktree-manager.ts`**
- On worktree creation, if push is enabled:
  - Check for `GITHUB_TOKEN` / `GITLAB_TOKEN` → configure `credential.helper store` with token
  - Check for SSH remote URL → skip HTTPS credential setup
  - Check for `GIT_CREDENTIALS_URL` → write to `.git-credentials`
- Do nothing if push is disabled (no credentials needed)

### WB-3: GPG Signing Detection
**`src/server/git/worktree-manager.ts`**
- Check if repo has `commit.gpgsign=true` in git config
- If yes and GPG agent/keys not available, log a warning at startup
- Surface the warning via the health/status API so the UI can show it

### WB-4: Unpushed Commit Tracking
**`src/server/git/local-adapter.ts`** or new service
- Track count of commits in worktree ahead of origin
- Expose via `GET /api/repo/status` (extend existing endpoint)
- `{ unpushedCommits: 3 }`

### WB-5: Push Button in UI
**`src/client/components/RepoStatusIndicator.tsx`**
- When `unpushedCommits > 0`, show count and a "Push" button
- Push button calls new `POST /api/repo/push` endpoint
- Show success/error feedback

### WB-6: Push API Endpoint
**`src/server/api/routes/repo-status.ts`** or new route
- `POST /api/repo/push` — pushes all unpushed worktree commits to origin
- Uses the same push + retry logic extracted from `_writeViaWorktree`
- Requires editor role
- Returns `{ pushed: true, commits: N }` or error with credential hint

### WB-7: Error Messages
- Push failures: "Push failed — no git credentials configured. Set GITHUB_TOKEN or mount SSH keys."
- GPG failures: "Commit requires GPG signing but no GPG key is available."
- Surface via the existing error toast pattern in Board.tsx

### WB-8: Documentation & Docker Compose
- Update `docker-compose.yml` with commented examples for SSH mount, token env var
- Document the push behavior in a README section or CLAUDE.md

## Key Risks

| Risk | Mitigation |
|------|------------|
| Local refs get out of sync when not pushing | Update local branch ref after commit using `update-ref` |
| Developer forgets to push, loses work | Show prominent "N unpushed" indicator |
| Existing cloud deployments break | Mode defaults preserve current behavior |
| Worktree fetch fails without credentials | In no-push mode, skip the `fetch origin` before checkout — work from local branch state |
