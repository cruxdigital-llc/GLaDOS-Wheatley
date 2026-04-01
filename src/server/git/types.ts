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
 * Thrown by GitAdapter.writeFile when a concurrent write conflict is detected.
 * Local: push rejected as non-fast-forward.
 * Remote: GitHub API returned 409.
 */
export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

/**
 * Unified interface for reading from and writing to a git repository.
 * Read methods return null/empty on errors (never throw).
 * writeFile throws ConflictError on concurrent-write conflicts, Error for other failures.
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

  /**
   * Write a file to the repository on the specified branch and commit.
   * If branch is omitted, the adapter uses its default branch.
   * Throws ConflictError if the write is rejected due to a concurrent modification.
   * Throws Error for all other failures.
   */
  writeFile(path: string, content: string, message: string, branch?: string): Promise<void>;

  /**
   * Get the number of commits that `branch` is behind `baseBranch`.
   * Returns 0 if the branch is up-to-date or on error.
   */
  getCommitsBehind(branch: string, baseBranch: string): Promise<number>;

  /**
   * Get the ISO 8601 date string of the most recent commit on `branch`.
   * Returns null on error.
   */
  getLastCommitDate(branch: string): Promise<string | null>;

  /**
   * Get the working tree status of the repository.
   * Returns clean status for remote adapters (no working tree).
   */
  getRepoStatus(): Promise<RepoStatus>;

  /**
   * Get the git identity (user.name, user.email) configured for this repository.
   * Returns nulls if not configured.
   */
  getGitIdentity(): Promise<GitIdentity>;

  /**
   * Delete one or more files from the repository and commit.
   * Throws ConflictError on concurrent-write conflicts.
   * Throws Error for all other failures.
   */
  deleteFiles(paths: string[], message: string, branch?: string): Promise<void>;

  /**
   * Fetch latest refs from the remote. No-op for remote adapters.
   */
  fetchOrigin(): Promise<void>;
}

export interface GitIdentity {
  name: string | null;
  email: string | null;
}

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
}

export interface RepoStatus {
  /** True if the working tree has no uncommitted changes. */
  clean: boolean;
  /** Number of modified files. */
  modified: number;
  /** Number of untracked files. */
  untracked: number;
  /** Number of staged (added) files. */
  staged: number;
  /** True if a merge conflict is in progress. */
  conflicted: boolean;
  /** Paths with merge conflicts. */
  conflictedFiles: string[];
  /** True if the worktree isolation is active (writes are safe). */
  worktreeActive: boolean;
}

export interface GitAdapterConfig {
  mode: 'local' | 'remote';
  /** Path to the local repository (required for local mode). */
  localPath?: string;
  /** GitHub API configuration (required for remote mode). */
  github?: GitHubConfig;
}
