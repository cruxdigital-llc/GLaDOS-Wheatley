# Requirements: Auth Paradigm Completion

## Problem Statement

PR #14 (`chore/mode-cleanup`) decoupled auth mode from git mode — the right architectural split. But the implementation has four gaps that prevent it from delivering the intended developer experience.

## Intended Paradigm

| Mode | Identity Source | Auth Required? | Git Access | Developer Experience |
|------|----------------|----------------|------------|---------------------|
| **Local** | Dev's `git config user.name` / `user.email` | None | Direct filesystem via local git | Zero friction — boot and go |
| **Cloud** | GitHub/GitLab OAuth profile | Yes, auto-redirected | Via platform API using OAuth token | Invisible — just a login redirect, gated by repo access |

## Gap Analysis

### G1: Local mode identity falls back to "Local User"

- `authMiddleware` reads `WHEATLEY_COMMIT_AUTHOR` env var (line 39 of `middleware.ts`)
- If unset (the common case for local devs), every user appears as "Local User"
- The `getGitIdentity()` method on `GitAdapter` already reads `git config user.name`/`user.email` but the middleware never calls it

### G2: Client never sends JWT after OAuth login

- OAuth callback stores JWT: `localStorage.setItem('wheatley_token', jwt)`
- `fetchJson()` in `api.ts` never reads localStorage, never attaches `Authorization: Bearer` header
- Cloud mode 401s on every API call after successful login
- No 401 handling — user sees a broken board with no recovery path

### G3: No repo-level access verification in cloud mode

- After OAuth, any valid GitHub/GitLab user receives an `editor` JWT
- No call to `GET /repos/{owner}/{repo}/collaborators/{username}` (GitHub) or equivalent
- A random GitHub user with zero repo access gets full editor permissions

### G4: No auto-detection of OAuth provider from repo URL

- Operator must manually set `GITHUB_CLIENT_ID` or `GITLAB_CLIENT_ID` env vars
- No startup hint about which provider is needed based on the repo
- If misconfigured, login page shows "Contact your administrator" with no useful guidance

## Success Criteria

1. A local dev with `git config user.name` set sees their real name in the UI without configuring any env vars
2. A cloud user completes OAuth login and lands on a working board (no 401s)
3. A cloud user who is NOT a collaborator on the target repo is denied access with a clear message
4. A cloud deployment with missing OAuth config gets a clear startup warning identifying the expected provider

## Priority

G1 and G2 are critical (broken functionality). G3 is important (security gap). G4 is nice-to-have (operational ergonomics).
