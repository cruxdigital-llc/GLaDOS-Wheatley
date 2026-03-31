# Specification: Auth Paradigm Completion

## Overview

Four targeted fixes to the auth system introduced in PR #14 (`chore/mode-cleanup`). The mode split architecture is sound; this spec closes implementation gaps so local mode is zero-friction and cloud mode is functional end-to-end with repo-level access gating.

---

## 1. Local Mode Git Identity Resolution

### 1.1 Middleware Signature Change

**File**: `src/server/auth/middleware.ts`

```ts
// Before
export function authMiddleware(config: AuthConfig) { ... }

// After
export function authMiddleware(config: AuthConfig, adapter?: GitAdapter) { ... }
```

Import `GitAdapter` type from `../git/types.js` and `GitIdentity` for the cached value.

### 1.2 Identity Resolution Logic

Inside the `config.mode === 'local'` branch, replace the current env-var-only lookup with a cached resolution chain:

```ts
// Module-level cache
let cachedLocalIdentity: { name: string | null; email: string | null } | undefined;

// Inside authenticate():
if (config.mode === 'local') {
  // Resolve identity once (env var > git config > fallback)
  if (!cachedLocalIdentity) {
    const envAuthor = process.env['WHEATLEY_COMMIT_AUTHOR'];
    if (envAuthor) {
      const name = envAuthor.replace(/<.*>/, '').trim() || null;
      const email = envAuthor.match(/<(.+?)>/)?.[1] ?? null;
      cachedLocalIdentity = { name, email };
    } else if (adapter) {
      const git = await adapter.getGitIdentity();
      cachedLocalIdentity = { name: git.name, email: git.email };
    } else {
      cachedLocalIdentity = { name: null, email: null };
    }
  }

  request.user = {
    id: 'local',
    name: cachedLocalIdentity.name || 'Local User',
    email: cachedLocalIdentity.email ?? undefined,
    provider: 'local',
    role: 'editor',
  };
  return;
}
```

### 1.3 Server Wiring

**File**: `src/server/api/server.ts` (line ~89)

```ts
// Before
const authHook = authMiddleware(authConfig);

// After
const authHook = authMiddleware(authConfig, options.adapter);
```

### 1.4 Edge Cases

- **No git config set**: Falls back to "Local User" — same as current behavior, no regression.
- **`WHEATLEY_COMMIT_AUTHOR` set**: Env var wins — backward compatible.
- **Remote adapter in local mode**: `getGitIdentity()` returns `{ name: null, email: null }` — falls through to "Local User". This is correct; remote adapter has no local git config.

---

## 2. Client JWT Attachment

### 2.1 fetchJson Enhancement

**File**: `src/client/api.ts`

Replace the current `fetchJson` function:

```ts
async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  // Attach JWT if available (cloud mode)
  const token = typeof window !== 'undefined'
    ? localStorage.getItem('wheatley_token')
    : null;
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    // Token expired or invalid — clear and redirect to login
    if (typeof window !== 'undefined') {
      localStorage.removeItem('wheatley_token');
      window.location.href = '/login';
    }
    throw new Error('Authentication required');
  }

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}
```

### 2.2 Behavioral Notes

- **Local mode**: `wheatley_token` is never set in localStorage, so `token` is `null` and no header is attached. Server middleware skips auth check. No behavioral change.
- **Cloud mode**: After OAuth callback sets the token, all subsequent API calls include the Bearer header. If the token expires (24h default), the 401 handler clears it and redirects to `/login` for re-auth.
- **SSR guard**: `typeof window !== 'undefined'` prevents errors if this code is ever evaluated server-side.

---

## 3. Repo Access Verification

### 3.1 GitHub Collaborator Check

**File**: `src/server/auth/oauth-routes.ts`

After the user profile fetch in the GitHub callback (~line 165), add:

```ts
// Verify user has access to the target repository
const repoOwner = process.env['GITHUB_OWNER'];
const repoName = process.env['GITHUB_REPO'];

if (repoOwner && repoName) {
  const collabRes = await fetch(
    `https://api.github.com/repos/${repoOwner}/${repoName}/collaborators/${profile.login}`,
    { headers: { Authorization: `Bearer ${tokenData.access_token}` } },
  );

  if (collabRes.status === 404 || collabRes.status === 403) {
    return reply.type('text/html').send(accessDeniedHtml(profile.login, `${repoOwner}/${repoName}`));
  }

  // If 204, user is a collaborator. Check permission level.
  if (collabRes.status === 204) {
    const permRes = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/collaborators/${profile.login}/permission`,
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } },
    );
    const permData = (await permRes.json()) as { permission?: string };
    // Map GitHub permissions to Wheatley roles
    // admin -> admin, write/maintain -> editor, read/triage -> viewer
    const ghPerm = permData.permission ?? 'read';
    const mappedRole = ghPerm === 'admin' ? 'admin'
      : ['write', 'maintain'].includes(ghPerm) ? 'editor'
      : 'viewer';
    user.role = resolveRole(profile.login, profile.email ?? undefined) === 'admin'
      ? 'admin'  // WHEATLEY_ADMIN_USERS override still wins
      : mappedRole;
  }
}
```

### 3.2 OAuth Scope Update

**File**: `src/server/auth/oauth-routes.ts` (line 77)

The collaborator API on private repos requires `repo` scope:

```ts
// Before
scope: 'read:user user:email',

// After
scope: 'read:user user:email repo',
```

Note: For public repos, `read:user` suffices. Adding `repo` scope is necessary for private repo access verification. This is standard for GitHub Apps that need to check repo membership.

### 3.3 GitLab Member Check

In the GitLab callback, after profile fetch:

```ts
const projectId = process.env['GITLAB_PROJECT_ID'];

if (projectId) {
  const memberRes = await fetch(
    `${config.gitlab.baseUrl}/api/v4/projects/${projectId}/members/all/${profile.id}`,
    { headers: { Authorization: `Bearer ${tokenData.access_token}` } },
  );

  if (!memberRes.ok) {
    return reply.type('text/html').send(
      accessDeniedHtml(profile.username, `project ${projectId}`),
    );
  }

  const memberData = (await memberRes.json()) as { access_level?: number };
  // GitLab access levels: 10=Guest, 20=Reporter, 30=Developer, 40=Maintainer, 50=Owner
  const level = memberData.access_level ?? 10;
  const mappedRole = level >= 40 ? 'admin' : level >= 30 ? 'editor' : 'viewer';
  user.role = resolveRole(profile.username, profile.email ?? undefined) === 'admin'
    ? 'admin'
    : mappedRole;
}
```

### 3.4 Access Denied Page

Add helper function in `oauth-routes.ts`:

```ts
function accessDeniedHtml(username: string, repoRef: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Access Denied — Wheatley</title>
<style>
  body { font-family: -apple-system, sans-serif; background: #0d1117; color: #c9d1d9;
         display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  .card { background: #161b22; border: 1px solid #30363d; border-radius: 12px;
          padding: 40px; max-width: 460px; text-align: center; }
  h1 { color: #f85149; font-size: 1.3rem; margin-bottom: 12px; }
  p { color: #8b949e; margin-bottom: 20px; }
  a { color: #58a6ff; }
</style></head>
<body><div class="card">
  <h1>Access Denied</h1>
  <p><strong>${username}</strong> does not have access to <strong>${repoRef}</strong>.</p>
  <p>Ask a repository admin to add you as a collaborator, then <a href="/login">try again</a>.</p>
</div></body></html>`;
}
```

### 3.5 Edge Cases

- **`GITHUB_OWNER`/`GITHUB_REPO` not set**: Skip collaborator check, fall through to existing behavior (any authenticated user gets `editor`). This preserves backward compatibility for deployments that don't set these vars.
- **Rate limiting**: GitHub collaborator API is lightweight (no body). Rate limit risk is minimal since it's called once per login.
- **Public repos**: The `repo` scope still works; the collaborator API returns meaningful results for public repos too (contributors vs. non-contributors).

---

## 4. Provider Auto-Detection (Advisory)

### 4.1 Startup Warning

**File**: `src/server/auth/config.ts`

At the end of `loadAuthConfig()`, before the return:

```ts
// Advisory: warn if cloud mode has no OAuth provider but we can detect the platform
if (mode === 'cloud' && !github && !gitlab) {
  const owner = process.env['GITHUB_OWNER'];
  const token = process.env['GITHUB_TOKEN'];
  if (owner || token) {
    console.warn(
      '[auth] Cloud mode detected with GitHub repo but no OAuth configured. ' +
      'Set GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, and GITHUB_OAUTH_CALLBACK ' +
      'to enable user login.',
    );
  }

  const gitlabProject = process.env['GITLAB_PROJECT_ID'];
  if (gitlabProject) {
    console.warn(
      '[auth] Cloud mode detected with GitLab project but no OAuth configured. ' +
      'Set GITLAB_CLIENT_ID, GITLAB_CLIENT_SECRET, and GITLAB_OAUTH_CALLBACK ' +
      'to enable user login.',
    );
  }
}
```

### 4.2 JWT Expiry Validation

Also in `loadAuthConfig()`, validate the parsed `jwtExpirySeconds`:

```ts
if (isNaN(jwtExpirySeconds) || jwtExpirySeconds <= 0) {
  throw new Error(
    `Invalid WHEATLEY_JWT_EXPIRY: "${process.env['WHEATLEY_JWT_EXPIRY']}". Must be a positive integer (seconds).`,
  );
}
```

---

## 5. No Data Model Changes

All changes are behavioral — no new types, no schema changes, no new files beyond the spec docs. The existing `AuthUser`, `AuthConfig`, and `UserRole` types are sufficient.

---

## 6. Test Plan

| Fix | Test File | Cases |
|-----|-----------|-------|
| 1 | `src/server/auth/__tests__/middleware.test.ts` | Local mode: adapter identity used. Env var override wins. Null identity fallback. Cache hit on second request. |
| 2 | `src/client/__tests__/api.test.ts` | Token attached when present. No header when absent. 401 clears token and redirects. |
| 3 | `src/server/auth/__tests__/oauth-routes.test.ts` | GitHub: 204 collaborator -> JWT with mapped role. 404 -> 403 HTML. GitLab: member found -> JWT. Not found -> 403. ADMIN_USERS override wins. |
| 4 | `src/server/auth/__tests__/config.test.ts` | Cloud + no OAuth + GITHUB_OWNER -> warning logged. Cloud + OAuth configured -> no warning. Invalid JWT expiry -> throws. |
