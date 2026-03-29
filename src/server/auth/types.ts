/**
 * Auth Types
 *
 * Defines user roles, authenticated user shape, and auth configuration.
 */

export type UserRole = 'viewer' | 'editor' | 'admin';

export interface AuthUser {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  provider: 'local' | 'github' | 'gitlab';
  role: UserRole;
}

export interface AuthConfig {
  mode: 'local' | 'cloud';
  jwtSecret: string;
  jwtExpirySeconds: number;
  apiKey?: string;
  github?: { clientId: string; clientSecret: string; callbackUrl: string };
  gitlab?: { clientId: string; clientSecret: string; callbackUrl: string; baseUrl: string };
}
