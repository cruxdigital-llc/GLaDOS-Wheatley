# Plan: Fix Auth Gaps in PR #14

## Context

PR #14 decouples auth mode from git mode — good architecture. But four gaps remain before it matches the intended paradigm: local devs get zero-friction identity from `git config`, and cloud users get seamless OAuth with repo-level access verification.

---

## Fix 1: Local Mode — Pull identity from `git config` instead of env var

**Problem:** `authMiddleware` hardcodes identity from `WHEATLEY_COMMIT_AUTHOR` env var, falling back to "Local User". The `getGitIdentity()` method on the adapter already reads `git config user.name` / `user.email`, but the middleware doesn't use it.

**Files changed:**
- `src/server/auth/middleware.ts` — accept `GitAdapter` (or a cached identity) so local mode reads from git config
- `src/server/api/server.ts` — pass the adapter (or resolved identity) into `authMiddleware`

**Approach:**
1. Change `authMiddleware(config)` signature to `authMiddleware(config, options?: { adapter?: GitAdapter })`.
2. On first local-mode request, call `adapter.getGitIdentity()` once, cache the result. Use it to populate `request.user.name` and `request.user.email`.
3. Keep `WHEATLEY_COMMIT_AUTHOR` as an explicit override (if set, it wins). Otherwise fall through to `getGitIdentity()`. Only use "Local User" as last resort if both are empty.
4. In `server.ts`, pass `{ adapter: options.adapter }` to `authMiddleware`.

---

## Fix 2: Client — Send JWT on API requests in cloud mode

**Problem:** OAuth callback stores JWT in `localStorage.setItem('wheatley_token', ...)` but `fetchJson()` in `api.ts` never reads it or attaches an `Authorization` header. Cloud mode 401s on every API call after login.

**Files changed:**
- `src/client/api.ts` — add auth header to `fetchJson`

**Approach:**
1. In `fetchJson`, read `localStorage.getItem('wheatley_token')`. If present, add `Authorization: Bearer <token>` to the request headers.
2. On 401 response, clear the stored token and redirect to `/login` so the user re-authenticates rather than seeing a broken board.
3. This is a no-op in local mode because local mode never writes to `wheatley_token` and the server doesn't require a Bearer header.

---

## Fix 3: Cloud Mode — Verify user has access to the target repository

**Problem:** After OAuth, the server issues a JWT to any valid GitHub/GitLab user without checking if they're a collaborator on the target repo. A random GitHub user with no repo access gets `editor` role.

**Files changed:**
- `src/server/auth/oauth-routes.ts` — add repo access check after profile fetch

**Approach:**
1. After fetching the user profile in the GitHub callback, use the OAuth access token to call `GET /repos/{owner}/{repo}/collaborators/{username}` (returns 204 if collaborator, 404 if not). The `owner` and `repo` come from existing env vars `GITHUB_OWNER` / `GITHUB_REPO`.
2. For GitLab, call `GET /api/v4/projects/{id}/members/all/{user_id}` (or check project access level).
3. If the user is not a collaborator, return a 403 with a clear message instead of issuing a JWT.
4. Use the collaborator's permission level (admin/write/read) to map to the `UserRole` (`admin`/`editor`/`viewer`) instead of defaulting everyone to `editor`.

---

## Fix 4: Auto-detect OAuth provider from repo remote URL

**Problem:** The operator must manually set `GITHUB_CLIENT_ID` or `GITLAB_CLIENT_ID` env vars. The system doesn't infer which provider to use from the repository's remote URL.

**Files changed:**
- `src/server/auth/config.ts` — add provider detection logic

**Approach:**
1. If neither `GITHUB_CLIENT_ID` nor `GITLAB_CLIENT_ID` is set but `WHEATLEY_MODE=remote`, inspect the repo remote URL (from `GITHUB_OWNER`/`GITHUB_REPO` or a new `WHEATLEY_REPO_URL` env var).
2. If the URL contains `github.com`, log a warning that GitHub OAuth credentials are needed.
3. If the URL contains `gitlab.com` (or a custom GitLab domain), log likewise.
4. This is advisory only — it won't magically create OAuth apps. But it eliminates the silent failure where cloud mode boots with no provider configured and the login page shows "Contact your administrator."
5. **This is the lowest priority fix** — could be deferred to a follow-up PR.

---

## Test Plan

- **Fix 1:** Unit test `authMiddleware` in local mode — mock `adapter.getGitIdentity()` returning `{ name: 'Jane', email: 'jane@dev.co' }`, verify `request.user` reflects it. Test env var override still wins. Test fallback to "Local User" when both are empty.
- **Fix 2:** Verify `fetchJson` attaches Bearer header when token exists in localStorage. Verify 401 response clears token and redirects. Verify no header attached when no token exists (local mode).
- **Fix 3:** Mock GitHub collaborator API — test 204 (access granted, JWT issued), 404 (access denied, 403 returned). Test permission-level-to-role mapping.
- **Fix 4:** Unit test URL pattern matching for github.com / gitlab.com domains. Test warning log output.

All existing 455 tests must continue to pass. Run via `docker compose run --rm server npx vitest run`.

---

## Execution Order

1. Fix 1 (local git identity) — standalone, no dependencies
2. Fix 2 (client JWT loop) — standalone, no dependencies
3. Fix 3 (repo access check) — depends on understanding the OAuth flow from Fix 2 review
4. Fix 4 (provider auto-detect) — lowest priority, can defer
