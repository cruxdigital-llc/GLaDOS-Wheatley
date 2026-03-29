/**
 * Git Adapter — barrel export
 */

export type { GitAdapter, DirectoryEntry, GitAdapterConfig, GitHubConfig } from './types.js';
export { ConflictError } from './types.js';
export { LocalGitAdapter } from './local-adapter.js';
export { RemoteGitAdapter } from './remote-adapter.js';
export { createGitAdapter, configFromEnv } from './factory.js';
