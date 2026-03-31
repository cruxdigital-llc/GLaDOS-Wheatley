/**
 * Auth — barrel export
 */

export { loadAuthConfig } from './config.js';
export { signToken, verifyToken } from './jwt.js';
export { authMiddleware, requireRole, _resetCachedLocalIdentity } from './middleware.js';
export { oauthRoutes } from './oauth-routes.js';
export { loginPageRoute } from './login-page.js';
export type { AuthConfig, AuthUser, UserRole } from './types.js';
