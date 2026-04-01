# Tasks: Auth Paradigm Completion

## Fix 1: Local Mode Git Identity
- [x] 1.1 Update `authMiddleware` signature to accept optional `GitAdapter`
- [x] 1.2 Add cached identity resolution chain (env var > git config > fallback)
- [x] 1.3 Wire adapter into middleware in `server.ts`
- [x] 1.4 Write unit tests for `authMiddleware` local mode identity resolution

## Fix 2: Client JWT Attachment
- [x] 2.1 Update `fetchJson` to read `wheatley_token` from localStorage and attach Bearer header
- [x] 2.2 Add 401 handler that clears token and redirects to `/login`
- [x] 2.3 Guard localStorage access with try/catch for private browsing
- [x] 2.4 Write unit tests for `fetchJson` auth behavior

## Fix 3: Repo Access Verification
- [x] 3.1 Add `accessDeniedHtml` helper to `oauth-routes.ts`
- [x] 3.2 Add GitHub collaborator check + permission-to-role mapping in GitHub callback
- [x] 3.3 Add GitLab member check + access-level-to-role mapping in GitLab callback
- [x] 3.4 Update GitHub OAuth scope from `read:user user:email` to `read:user user:email repo`
- [x] 3.5 Write unit tests for repo access verification

## Fix 4: Provider Auto-Detection Warning
- [x] 4.1 Add startup warning in `loadAuthConfig` when cloud mode has no OAuth but platform env vars exist
- [x] 4.2 Add JWT expiry validation (already present on PR #14 branch)
- [x] 4.3 Write unit tests for config warnings and validation (already present on PR #14 branch)
