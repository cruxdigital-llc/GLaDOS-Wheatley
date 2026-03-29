/**
 * Git Adapter Types
 *
 * Defines the unified interface for git operations used by the board.
 * Both local (simple-git) and remote (Octokit) adapters implement this.
 */

export interface DirectoryEntry {
  name: string;
  type: 'file' | 'directory';
  path: string;
}

/**
 * Unified interface for reading from a git repository.
 * All methods are async and return null/empty on errors (never throw).
 */
export interface GitAdapter {
  /** Read a file's content. Returns null if not found or on error. */
  readFile(path: string, ref?: string): Promise<string | null>;

  /** List directory contents. Returns empty array if not found or on error. */
  listDirectory(path: string, ref?: string): Promise<DirectoryEntry[]>;

  /** List all branches in the repository. */
  listBranches(): Promise<string[]>;

  /** Get the currently checked-out branch (local) or default branch (remote). */
  getCurrentBranch(): Promise<string>;

  /** Get the repository's default branch. */
  getDefaultBranch(): Promise<string>;

  /** Get the latest commit SHA for a branch. Returns null on error. */
  getLatestSha(branch?: string): Promise<string | null>;
}

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
}

export interface GitAdapterConfig {
  mode: 'local' | 'remote';
  /** Path to the local repository (required for local mode). */
  localPath?: string;
  /** GitHub API configuration (required for remote mode). */
  github?: GitHubConfig;
}
