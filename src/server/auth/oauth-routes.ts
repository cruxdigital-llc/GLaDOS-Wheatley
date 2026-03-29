/**
 * OAuth Routes
 *
 * Handles OAuth login flows for GitHub and GitLab.
 * GET  /auth/login              — redirect to OAuth consent screen
 * GET  /auth/callback/github    — handle GitHub OAuth callback
 * GET  /auth/callback/gitlab    — handle GitLab OAuth callback
 * GET  /auth/me                 — return current user info from JWT
 * POST /auth/logout             — no-op (client clears token)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { AuthConfig, AuthUser, UserRole } from './types.js';
import { signToken, verifyToken } from './jwt.js';

/** Parse WHEATLEY_ADMIN_USERS env var into a Set of lowercase identifiers. */
function getAdminUsers(): Set<string> {
  const raw = process.env['WHEATLEY_ADMIN_USERS'];
  if (!raw) return new Set();
  return new Set(
    raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
  );
}

/** Determine role based on admin user list. */
function resolveRole(username: string, email?: string): UserRole {
  const admins = getAdminUsers();
  if (admins.has(username.toLowerCase())) return 'admin';
  if (email && admins.has(email.toLowerCase())) return 'admin';
  return 'editor';
}

/** Build JWT payload from AuthUser. */
function userToPayload(user: AuthUser): Record<string, unknown> {
  return {
    sub: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    provider: user.provider,
    role: user.role,
  };
}

export function oauthRoutes(app: FastifyInstance, config: AuthConfig): void {
  // GET /auth/login — redirect to OAuth provider
  app.get('/auth/login', async (_request: FastifyRequest, reply: FastifyReply) => {
    if (config.github) {
      const params = new URLSearchParams({
        client_id: config.github.clientId,
        redirect_uri: config.github.callbackUrl,
        scope: 'read:user user:email',
      });
      return reply.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
    }

    if (config.gitlab) {
      const params = new URLSearchParams({
        client_id: config.gitlab.clientId,
        redirect_uri: config.gitlab.callbackUrl,
        response_type: 'code',
        scope: 'read_user',
      });
      return reply.redirect(`${config.gitlab.baseUrl}/oauth/authorize?${params.toString()}`);
    }

    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'No OAuth provider configured. Set GITHUB_CLIENT_ID or GITLAB_CLIENT_ID.',
    });
  });

  // GET /auth/callback/github — exchange code for token, fetch profile, issue JWT
  app.get<{ Querystring: { code?: string } }>(
    '/auth/callback/github',
    async (request: FastifyRequest<{ Querystring: { code?: string } }>, reply: FastifyReply) => {
      if (!config.github) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'GitHub OAuth is not configured.',
        });
      }

      const code = request.query.code;
      if (!code) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Missing "code" query parameter.',
        });
      }

      // Exchange code for access token
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: config.github.clientId,
          client_secret: config.github.clientSecret,
          code,
        }),
      });

      const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
      if (!tokenData.access_token) {
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: `GitHub OAuth failed: ${tokenData.error ?? 'no access token returned'}`,
        });
      }

      // Fetch user profile
      const userRes = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const profile = (await userRes.json()) as {
        id: number;
        login: string;
        name?: string;
        email?: string;
        avatar_url?: string;
      };

      const user: AuthUser = {
        id: String(profile.id),
        name: profile.name ?? profile.login,
        email: profile.email ?? undefined,
        avatarUrl: profile.avatar_url,
        provider: 'github',
        role: resolveRole(profile.login, profile.email ?? undefined),
      };

      const jwt = signToken(userToPayload(user), config.jwtSecret, config.jwtExpirySeconds);

      // Return a page that stores the token and redirects
      return reply.type('text/html').send(callbackHtml(jwt));
    },
  );

  // GET /auth/callback/gitlab — exchange code for token, fetch profile, issue JWT
  app.get<{ Querystring: { code?: string } }>(
    '/auth/callback/gitlab',
    async (request: FastifyRequest<{ Querystring: { code?: string } }>, reply: FastifyReply) => {
      if (!config.gitlab) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'GitLab OAuth is not configured.',
        });
      }

      const code = request.query.code;
      if (!code) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Missing "code" query parameter.',
        });
      }

      // Exchange code for access token
      const tokenRes = await fetch(`${config.gitlab.baseUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: config.gitlab.clientId,
          client_secret: config.gitlab.clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: config.gitlab.callbackUrl,
        }),
      });

      const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
      if (!tokenData.access_token) {
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: `GitLab OAuth failed: ${tokenData.error ?? 'no access token returned'}`,
        });
      }

      // Fetch user profile
      const userRes = await fetch(`${config.gitlab.baseUrl}/api/v4/user`, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const profile = (await userRes.json()) as {
        id: number;
        username: string;
        name?: string;
        email?: string;
        avatar_url?: string;
      };

      const user: AuthUser = {
        id: String(profile.id),
        name: profile.name ?? profile.username,
        email: profile.email ?? undefined,
        avatarUrl: profile.avatar_url,
        provider: 'gitlab',
        role: resolveRole(profile.username, profile.email ?? undefined),
      };

      const jwt = signToken(userToPayload(user), config.jwtSecret, config.jwtExpirySeconds);

      return reply.type('text/html').send(callbackHtml(jwt));
    },
  );

  // GET /auth/me — return current user info from JWT
  app.get('/auth/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Bearer token required.',
      });
    }

    const token = authHeader.slice(7);
    const payload = verifyToken(token, config.jwtSecret);
    if (!payload) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid or expired token.',
      });
    }

    return {
      id: payload['sub'],
      name: payload['name'],
      email: payload['email'],
      avatarUrl: payload['avatarUrl'],
      provider: payload['provider'],
      role: payload['role'],
    };
  });

  // POST /auth/logout — no-op, JWT is stateless
  app.post('/auth/logout', async () => {
    return { ok: true, message: 'Logged out. Clear the token on the client.' };
  });
}

/**
 * HTML page returned after successful OAuth callback.
 * Stores the JWT in localStorage and redirects to the app root.
 */
function callbackHtml(jwt: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Logging in...</title></head>
<body>
<p>Logging in&hellip;</p>
<script>
  try {
    localStorage.setItem('wheatley_token', ${JSON.stringify(jwt)});
  } catch (e) {
    // Fallback: pass token in URL hash
  }
  window.location.href = '/';
</script>
</body>
</html>`;
}
