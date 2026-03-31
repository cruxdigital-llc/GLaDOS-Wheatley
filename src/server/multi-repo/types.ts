/**
 * Multi-Repo Types
 *
 * Configuration shapes for managing multiple repositories.
 */

export interface RepoConfig {
  /** Unique slug (e.g., "main", "backend", "frontend") */
  id: string;
  /** Display name */
  name: string;
  /** Filesystem path (local mode) */
  path?: string;
  /** Remote URL (cloud mode) */
  remote?: string;
  /** Access token for remote */
  token?: string;
  /** Parser config preset name */
  parserPreset?: string;
}

export interface MultiRepoConfig {
  repos: RepoConfig[];
  defaultRepo: string;
}
