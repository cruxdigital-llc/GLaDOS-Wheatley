/**
 * Auth Middleware
 *
 * Fastify hooks for authentication and role-based authorization.
 * - Local mode: all requests allowed, user derived from git identity.
 * - Cloud mode: requires JWT bearer token or API key.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { AuthConfig, AuthUser, UserRole } from './types.js';
import { verifyToken } from './jwt.js';

// Role hierarchy for comparison
const ROLE_LEVELS: Record<UserRole, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
};

// Fastify module augmentation so request.user is typed
declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

/**
 * Returns a Fastify onRequest hook that authenticates incoming requests.
 * In local mode, every request is allowed and a default editor user is created.
 * In cloud mode, a valid JWT or API key is required.
 */
export function authMiddleware(config: AuthConfig) {
  return async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (config.mode === 'local') {
      // Local mode: always allow, create user from environment
      request.user = {
        id: 'local',
        name: process.env['WHEATLEY_COMMIT_AUTHOR']?.replace(/<.*>/, '').trim() || 'Local User',
        email: process.env['WHEATLEY_COMMIT_AUTHOR']?.match(/<(.+?)>/)?.[1],
        provider: 'local',
        role: 'editor',
      };
      return;
    }

    // Cloud mode: check for Bearer JWT
    const authHeader = request.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const payload = verifyToken(token, config.jwtSecret);
      if (payload) {
        request.user = {
          id: String(payload['sub'] ?? payload['id'] ?? ''),
          name: String(payload['name'] ?? ''),
          email: payload['email'] ? String(payload['email']) : undefined,
          avatarUrl: payload['avatarUrl'] ? String(payload['avatarUrl']) : undefined,
          provider: (payload['provider'] as AuthUser['provider']) ?? 'github',
          role: (payload['role'] as UserRole) ?? 'viewer',
        };
        return;
      }
    }

    // Cloud mode: check for API key
    const apiKeyHeader = request.headers['x-api-key'];
    if (apiKeyHeader && config.apiKey && apiKeyHeader === config.apiKey) {
      request.user = {
        id: 'api-key',
        name: 'API Key User',
        provider: 'local',
        role: 'admin',
      };
      return;
    }

    // No valid auth found
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Authentication required. Provide a Bearer token or X-API-Key header.',
    });
  };
}

/**
 * Returns a Fastify preHandler hook that enforces a minimum role.
 * Must be used after authMiddleware has attached request.user.
 */
export function requireRole(minRole: UserRole) {
  return async function checkRole(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const user = request.user;
    if (!user) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Authentication required.',
      });
    }

    if (ROLE_LEVELS[user.role] < ROLE_LEVELS[minRole]) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: `Role "${minRole}" or higher is required. Your role: "${user.role}".`,
      });
    }
  };
}
