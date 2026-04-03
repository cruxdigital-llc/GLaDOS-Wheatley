/**
 * Worktree Manager
 *
 * Manages a dedicated git worktree for Wheatley write operations.
 * This ensures Wheatley never modifies the developer's working tree, index,
 * or current branch when performing claims, transitions, or activity logging.
 */

import { resolve, join } from 'node:path';
import { access, rm } from 'node:fs/promises';
import simpleGit, { type SimpleGit } from 'simple-git';

export interface WorktreeManagerOptions {
  /** Path to the main git repository. */
  repoPath: string;
  /** Override worktree location. Default: {repoPath}/.wheatley-worktree */
  worktreePath?: string;
}

export class WorktreeManager {
  private readonly repoPath: string;
  private readonly worktreePath: string;
  private readonly mainGit: SimpleGit;
  private worktreeGit: SimpleGit | null = null;
  private _ready = false;
  private initPromise: Promise<void> | null = null;

  constructor(options: WorktreeManagerOptions) {
    this.repoPath = resolve(options.repoPath);
    this.worktreePath = options.worktreePath
      ? resolve(options.worktreePath)
      : join(this.repoPath, '.wheatley-worktree');
    this.mainGit = simpleGit(this.repoPath);
  }

  /** True if the worktree is initialized and usable. */
  isReady(): boolean {
    return this._ready;
  }

  /** Filesystem path of the worktree. */
  getPath(): string {
    return this.worktreePath;
  }

  /** simple-git instance pointed at the worktree. Throws if not ready. */
  getGit(): SimpleGit {
    if (!this.worktreeGit) {
      throw new Error('WorktreeManager not initialized — call init() first');
    }
    return this.worktreeGit;
  }

  /**
   * Initialize the worktree. Idempotent — safe to call multiple times.
   * If a stale worktree exists from a previous unclean shutdown, it is removed first.
   */
  async init(): Promise<void> {
    if (this._ready) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._doInit();
    return this.initPromise;
  }

  private async _doInit(): Promise<void> {
    const defaultBranch = await this.detectDefaultBranch();

    // Clean up stale worktree if it exists on disk
    if (await this.pathExists(this.worktreePath)) {
      await this.removeStaleWorktree();
    }

    try {
      // Also prune any dead worktree entries pointing to paths that no longer exist
      await this.mainGit.raw(['worktree', 'prune']);
    } catch {
      // Prune is best-effort
    }

    try {
      await this.mainGit.raw(['worktree', 'add', this.worktreePath, defaultBranch]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      // If the branch is already checked out in the worktree slot, try detached HEAD
      if (msg.includes('already checked out') || msg.includes('is already used by')) {
        try {
          await this.mainGit.raw(['worktree', 'add', '--detach', this.worktreePath]);
        } catch {
          this.logWarning('git worktree add failed — falling back to single-repo writes');
          return;
        }
      } else {
        this.logWarning(`git worktree add failed: ${msg} — falling back to single-repo writes`);
        return;
      }
    }

    this.worktreeGit = simpleGit(this.worktreePath);

    // Copy git user config from main repo into worktree
    await this.copyUserConfig();

    this._ready = true;
  }

  /**
   * Remove the worktree cleanly. Safe to call if not initialized.
   */
  async destroy(): Promise<void> {
    if (!this._ready && !await this.pathExists(this.worktreePath)) return;

    try {
      await this.mainGit.raw(['worktree', 'remove', '--force', this.worktreePath]);
    } catch {
      // If git worktree remove fails, try manual cleanup
      try {
        await rm(this.worktreePath, { recursive: true, force: true });
        await this.mainGit.raw(['worktree', 'prune']);
      } catch {
        // Best-effort cleanup
      }
    }

    this.worktreeGit = null;
    this._ready = false;
  }

  private async removeStaleWorktree(): Promise<void> {
    try {
      await this.mainGit.raw(['worktree', 'remove', '--force', this.worktreePath]);
    } catch {
      // If git command fails, force-remove the directory
      try {
        await rm(this.worktreePath, { recursive: true, force: true });
        await this.mainGit.raw(['worktree', 'prune']);
      } catch {
        // Best-effort
      }
    }
  }

  private async copyUserConfig(): Promise<void> {
    if (!this.worktreeGit) return;

    // Try repo config → env var → fallback. Filter out empty strings.
    const env = (key: string): string | undefined => process.env[key]?.trim() || undefined;

    let name: string | undefined;
    try {
      name = (await this.mainGit.raw(['config', 'user.name'])).trim() || undefined;
    } catch { /* no user.name configured */ }
    name = name ?? env('GIT_AUTHOR_NAME') ?? env('GIT_COMMITTER_NAME') ?? 'Wheatley';
    await this.worktreeGit.addConfig('user.name', name);

    let email: string | undefined;
    try {
      email = (await this.mainGit.raw(['config', 'user.email'])).trim() || undefined;
    } catch { /* no user.email configured */ }
    email = email ?? env('GIT_AUTHOR_EMAIL') ?? env('GIT_COMMITTER_EMAIL') ?? 'wheatley@localhost';
    await this.worktreeGit.addConfig('user.email', email);
  }

  private async detectDefaultBranch(): Promise<string> {
    try {
      const ref = await this.mainGit.raw(['symbolic-ref', 'refs/remotes/origin/HEAD']);
      return ref.trim().replace('refs/remotes/origin/', '');
    } catch {
      try {
        const result = await this.mainGit.branchLocal();
        if (result.all.includes('main')) return 'main';
        if (result.all.includes('master')) return 'master';
        return result.all[0] ?? 'main';
      } catch {
        return 'main';
      }
    }
  }

  private async pathExists(p: string): Promise<boolean> {
    try {
      await access(p);
      return true;
    } catch {
      return false;
    }
  }

  private logWarning(message: string): void {
    console.warn(`[WorktreeManager] ${message}`);
  }
}
