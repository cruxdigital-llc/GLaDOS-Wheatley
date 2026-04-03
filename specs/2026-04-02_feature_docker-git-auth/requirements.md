# Requirements: Docker Git Auth

## Goal

Make Wheatley's git write operations work reliably from inside Docker, with sensible defaults for local vs cloud deployments. Local mode should commit without pushing — developers expect to push on their own terms. Cloud mode pushes to keep the remote in sync.

## Context

Currently, the local git adapter commits to a worktree AND pushes to origin on every write (transition, claim, etc.). This fails inside Docker because:
1. No HTTPS credentials (personal access token, OAuth) available in the container
2. No SSH keys mounted
3. No GPG keys for repos requiring signed commits

More fundamentally, pushing on every local write is unexpected behavior for developers running Wheatley in Docker. They expect local commits they can review and push themselves.

## Functional Requirements

### FR-1: Local Mode Defaults to Commit-Only (No Push)
- When `WHEATLEY_MODE=local`, the git adapter should commit to the worktree but NOT push to origin
- This is the default for Docker development setups
- A "Push" or "Sync" button in the UI lets the user push when ready
- The repo status indicator should show "N unpushed commits" instead of the current dirty-state warning

### FR-2: Cloud Mode Pushes to Origin (Existing Behavior)
- When `WHEATLEY_MODE=cloud` or remote adapter is used, push-on-write remains the default
- This is correct for headless/CI/cloud deployments where no one is sitting at the terminal

### FR-3: Configurable Push Behavior
- `WHEATLEY_PUSH_ON_WRITE=true|false` env var to explicitly override the default
- Local mode: defaults to `false`
- Cloud mode: defaults to `true`
- Allows advanced users to opt into push-on-write for local mode if they want it

### FR-4: HTTPS Credential Support (When Push Is Enabled)
- Accept `GITHUB_TOKEN` or `GITLAB_TOKEN` env var and configure git credential helper in the worktree
- Support generic `GIT_CREDENTIALS_URL` for other hosts (e.g., `https://user:token@github.com`)
- Credential helper configured automatically on worktree creation — no manual setup needed

### FR-5: SSH Key Support (When Push Is Enabled)
- Mount SSH keys via Docker volume (`~/.ssh:/root/.ssh:ro`)
- Document the volume mount in docker-compose.yml as a commented example
- Detect SSH remote URLs and skip HTTPS credential configuration

### FR-6: GPG Signing Support
- Mount GPG agent socket or keys via Docker volume
- Configure `commit.gpgsign` in worktree when GPG is available
- When GPG is not available and repo requires signing, surface a clear error (not a cryptic git failure)

### FR-7: Clear Error Messages
- When a push fails due to missing credentials, show a user-friendly error: "Push failed: no git credentials configured. Set GITHUB_TOKEN or mount SSH keys."
- When GPG signing fails, show: "Commit failed: GPG signing required but not configured."
- Link to documentation for credential setup

## Non-Functional Requirements

### NFR-1: Zero-Config Local Development
- `docker compose up` with `REPO_PATH=../my-repo` should work out of the box with no credential setup
- Commits happen locally; developer pushes via their own terminal

### NFR-2: Backward Compatibility
- Existing cloud deployments with GITHUB_TOKEN continue to work unchanged
- No breaking changes to the API or config schema

## Success Criteria
1. `docker compose up` against a local repo → card transitions succeed (commit only, no push)
2. UI shows unpushed commit count and a Push button
3. With `GITHUB_TOKEN` set and `WHEATLEY_PUSH_ON_WRITE=true` → pushes work from Docker
4. SSH remote with mounted keys → pushes work
5. Repo requiring GPG signing → clear error message when GPG not configured
6. No regressions in cloud mode
