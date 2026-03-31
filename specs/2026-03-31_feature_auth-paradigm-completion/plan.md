# Plan: Auth Paradigm Completion

## Approach

Four targeted fixes layered on top of PR #14's existing auth architecture. No structural rework needed — the mode split is correct, we're closing implementation gaps.

## Fix 1: Local Mode Git Identity

**Files**: `src/server/auth/middleware.ts`, `src/server/api/server.ts`

- Extend `authMiddleware(config)` to accept an optional `GitAdapter`
- On first local-mode request, call `adapter.getGitIdentity()`, cache for process lifetime
- Priority chain: `WHEATLEY_COMMIT_AUTHOR` env var > `git config` > "Local User"
- Pass `options.adapter` from `server.ts` into middleware

## Fix 2: Client JWT Loop

**Files**: `src/client/api.ts`

- In `fetchJson`, read `localStorage.getItem('wheatley_token')`
- If present, merge `Authorization: Bearer <token>` into request headers
- On 401 response, clear token and redirect to `/login`
- No-op in local mode (token never written to localStorage)

## Fix 3: Repo Access Verification

**Files**: `src/server/auth/oauth-routes.ts`

- After GitHub profile fetch, call `GET /repos/{owner}/{repo}/collaborators/{username}` with the OAuth access token
- 204 = access granted, map permission level to role (`admin`/`push`/`pull` -> `admin`/`editor`/`viewer`)
- 404/403 = deny with 403 HTML page
- For GitLab: `GET /api/v4/projects/{id}/members/all/{user_id}`
- `GITHUB_OWNER`/`GITHUB_REPO` already available as env vars from remote adapter config

## Fix 4: Provider Auto-Detection (Advisory)

**Files**: `src/server/auth/config.ts`

- If cloud mode + no OAuth provider configured, inspect `GITHUB_OWNER` env var
- Log startup warning identifying expected provider
- Advisory only — no behavioral change

## Execution Order

1. Fix 1 + Fix 2 (parallel, no dependencies)
2. Fix 3 (after Fix 2, needs client sending tokens for end-to-end)
3. Fix 4 (lowest priority, if time permits)

## Risk

- Fix 1: `getGitIdentity()` is async — middleware needs to handle the initial async call gracefully. Cache after first resolution.
- Fix 2: Must not break local mode — guard on token existence.
- Fix 3: GitHub collaborator API requires the OAuth token to have `repo` scope or the repo to be public. Current OAuth scope is `read:user user:email` — may need to add `repo` scope.
