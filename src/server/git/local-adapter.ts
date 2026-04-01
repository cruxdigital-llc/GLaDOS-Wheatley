/**
 * Local Git Adapter
 *
 * Reads from a filesystem-mounted git repository using simple-git.
 * Writes go through an isolated git worktree (when available) so the
 * developer's working tree, index, and current branch are never touched.
 *
 * Used in Docker sidecar mode (WHEATLEY_MODE=local).
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import simpleGit, { type SimpleGit } from 'simple-git';
import type { GitAdapter, DirectoryEntry, RepoStatus, GitIdentity } from './types.js';
import { ConflictError } from './types.js';
import type { WorktreeManager } from './worktree-manager.js';

/** Validate ref strings to prevent command-line injection. */
const SAFE_REF_RE = /^[a-zA-Z0-9_./-]+$/;

/** Maximum push-conflict retries (fetch + reset + retry). */
const MAX_PUSH_RETRIES = 3;

export class LocalGitAdapter implements GitAdapter {
  private readonly git: SimpleGit;
  private readonly repoPath: string;
  private readonly worktreeManager: WorktreeManager | null;
  private writeLock: Promise<void> = Promise.resolve();
  private legacyWarned = false;

  constructor(repoPath: string, worktreeManager?: WorktreeManager) {
    this.repoPath = resolve(repoPath);
    this.git = simpleGit(this.repoPath);
    this.worktreeManager = worktreeManager ?? null;
  }

  private acquireWriteLock(): Promise<() => void> {
    let release: () => void;
    const next = new Promise<void>(resolve => { release = resolve; });
    const prev = this.writeLock;
    this.writeLock = next;
    return prev.then(() => release!);
  }

  /** Resolve a path within the repo, preventing path traversal attacks. */
  private safePath(path: string): string {
    const resolved = resolve(this.repoPath, path);
    if (!resolved.startsWith(this.repoPath)) {
      throw new Error('Path traversal detected');
    }
    return resolved;
  }

  /** Resolve a path within the worktree, preventing path traversal attacks. */
  private safeWorktreePath(path: string): string {
    if (!this.worktreeManager) throw new Error('No worktree available');
    const base = this.worktreeManager.getPath();
    const resolved = resolve(base, path);
    if (!resolved.startsWith(base)) {
      throw new Error('Path traversal detected');
    }
    return resolved;
  }

  /** Validate a git ref to prevent command-line injection. */
  private safeRef(ref: string): string {
    if (!SAFE_REF_RE.test(ref)) {
      throw new Error(`Invalid git ref: "${ref}"`);
    }
    return ref;
  }

  /** Validate a git tree path — reject null bytes, control chars, and traversal. */
  private safeTreePath(path: string): string {
    if (path.includes('\0') || path.includes('..') || /[\x00-\x1f]/.test(path)) {
      throw new Error(`Invalid path: "${path}"`);
    }
    return path;
  }

  async readFile(path: string, ref?: string): Promise<string | null> {
    try {
      const safePath = this.safeTreePath(path);
      const effectiveRef = ref ?? 'HEAD';
      const safeRef = this.safeRef(effectiveRef);
      return await this.git.show([`${safeRef}:${safePath}`]);
    } catch {
      return null;
    }
  }

  async listDirectory(path: string, ref?: string): Promise<DirectoryEntry[]> {
    try {
      const safePath = this.safeTreePath(path);
      const effectiveRef = ref ?? 'HEAD';
      const safeRef = this.safeRef(effectiveRef);
      return await this.listFromGit(safePath, safeRef);
    } catch {
      return [];
    }
  }

  async listBranches(): Promise<string[]> {
    try {
      const result = await this.git.branchLocal();
      return result.all;
    } catch {
      return [];
    }
  }

  async getCurrentBranch(): Promise<string> {
    try {
      const branch = await this.git.revparse(['--abbrev-ref', 'HEAD']);
      return branch.trim();
    } catch {
      return 'main';
    }
  }

  async getDefaultBranch(): Promise<string> {
    try {
      const ref = await this.git.raw(['symbolic-ref', 'refs/remotes/origin/HEAD']);
      return ref.trim().replace('refs/remotes/origin/', '');
    } catch {
      try {
        const branches = await this.listBranches();
        if (branches.includes('main')) return 'main';
        if (branches.includes('master')) return 'master';
        return branches[0] ?? 'main';
      } catch {
        return 'main';
      }
    }
  }

  async getLatestSha(branch?: string): Promise<string | null> {
    try {
      const ref = branch ?? (await this.getCurrentBranch());
      const sha = await this.git.revparse([ref]);
      return sha.trim();
    } catch {
      return null;
    }
  }

  async writeFile(path: string, content: string, message: string, branch?: string): Promise<void> {
    const release = await this.acquireWriteLock();
    try {
      if (this.worktreeManager?.isReady()) {
        await this._writeViaWorktree(path, content, message, branch);
      } else {
        await this._writeViaMainRepo(path, content, message, branch);
      }
    } finally {
      release();
    }
  }

  /**
   * Write via the isolated worktree — developer's working tree is untouched.
   */
  private async _writeViaWorktree(path: string, content: string, message: string, branch?: string): Promise<void> {
    const wt = this.worktreeManager!.getGit();
    const targetBranch = this.safeRef(branch ?? (await this.getDefaultBranch()));

    // Validate path before any git operations
    const fullPath = this.safeWorktreePath(path);

    // Fetch latest from origin and detach HEAD to the target branch tip.
    // We always use detached HEAD to avoid "branch already checked out" errors
    // (the main repo may have the same branch checked out).
    await wt.fetch('origin');
    await wt.raw(['checkout', `origin/${targetBranch}`]);

    // Write file to the worktree filesystem
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content, 'utf-8');

    // Stage and commit (on detached HEAD)
    await wt.add(path);
    await wt.commit(message);

    // Push detached HEAD to the remote branch, with retry on conflict
    for (let attempt = 1; attempt <= MAX_PUSH_RETRIES; attempt++) {
      try {
        await wt.raw(['push', 'origin', `HEAD:${targetBranch}`]);
        // Update main repo's remote refs and fast-forward local branch
        // so reads via `git show {branch}:path` reflect the push
        await this.git.fetch('origin').catch(() => { /* best-effort */ });
        await this.git.raw(['update-ref', `refs/heads/${targetBranch}`, `origin/${targetBranch}`]).catch(() => { /* best-effort */ });
        return; // Success
      } catch (pushErr) {
        const msg = pushErr instanceof Error ? pushErr.message : String(pushErr);
        const isConflict = msg.includes('non-fast-forward') || msg.includes('rejected');

        if (!isConflict || attempt === MAX_PUSH_RETRIES) {
          if (isConflict) {
            throw new ConflictError(`Push rejected after ${MAX_PUSH_RETRIES} attempts on ${path}`);
          }
          throw pushErr;
        }

        // Retry: fetch, reset to remote tip, re-apply write
        await wt.fetch('origin');
        await wt.raw(['checkout', `origin/${targetBranch}`]);
        await mkdir(dirname(fullPath), { recursive: true });
        await writeFile(fullPath, content, 'utf-8');
        await wt.add(path);
        await wt.commit(message);
      }
    }
  }

  async deleteFiles(paths: string[], message: string, branch?: string): Promise<void> {
    if (paths.length === 0) return;
    const release = await this.acquireWriteLock();
    try {
      if (this.worktreeManager?.isReady()) {
        await this._deleteViaWorktree(paths, message, branch);
      } else {
        await this._deleteViaMainRepo(paths, message, branch);
      }
    } finally {
      release();
    }
  }

  /**
   * Delete files via the isolated worktree.
   */
  private async _deleteViaWorktree(paths: string[], message: string, branch?: string): Promise<void> {
    const wt = this.worktreeManager!.getGit();
    const targetBranch = this.safeRef(branch ?? (await this.getDefaultBranch()));

    await wt.fetch('origin');
    await wt.raw(['checkout', `origin/${targetBranch}`]);

    // Remove files from the index and working tree
    await wt.raw(['rm', '-r', '--ignore-unmatch', '--', ...paths]);
    await wt.commit(message);

    for (let attempt = 1; attempt <= MAX_PUSH_RETRIES; attempt++) {
      try {
        await wt.raw(['push', 'origin', `HEAD:${targetBranch}`]);
        await this.git.fetch('origin').catch(() => { /* best-effort */ });
        await this.git.raw(['update-ref', `refs/heads/${targetBranch}`, `origin/${targetBranch}`]).catch(() => { /* best-effort */ });
        return;
      } catch (pushErr) {
        const msg = pushErr instanceof Error ? pushErr.message : String(pushErr);
        const isConflict = msg.includes('non-fast-forward') || msg.includes('rejected');

        if (!isConflict || attempt === MAX_PUSH_RETRIES) {
          if (isConflict) {
            throw new ConflictError(`Push rejected after ${MAX_PUSH_RETRIES} attempts (deleteFiles)`);
          }
          throw pushErr;
        }

        await wt.fetch('origin');
        await wt.raw(['checkout', `origin/${targetBranch}`]);
        await wt.raw(['rm', '-r', '--ignore-unmatch', '--', ...paths]);
        await wt.commit(message);
      }
    }
  }

  /**
   * Delete files via the main repo (legacy path).
   */
  private async _deleteViaMainRepo(paths: string[], message: string, branch?: string): Promise<void> {
    const targetBranch = this.safeRef(branch ?? (await this.getDefaultBranch()));
    const originalBranch = await this.getCurrentBranch();

    const status = await this.git.status();
    if (!status.isClean()) {
      throw new Error('Working tree is not clean; cannot delete files (no worktree available)');
    }

    await this.git.checkout(targetBranch);

    try {
      await this.git.raw(['rm', '-r', '--ignore-unmatch', '--', ...paths]);
      await this.git.commit(message);

      try {
        await this.git.push('origin', targetBranch);
      } catch (pushErr) {
        const msg = pushErr instanceof Error ? pushErr.message : String(pushErr);
        if (msg.includes('non-fast-forward') || msg.includes('rejected')) {
          try {
            await this.git.reset(['--hard', `origin/${targetBranch}`]);
          } catch {
            // Best-effort reset
          }
          throw new ConflictError(`Push rejected: non-fast-forward conflict (deleteFiles)`);
        }
        throw pushErr;
      }
    } finally {
      try {
        await this.git.checkout(originalBranch);
      } catch {
        // Ignore checkout errors during cleanup
      }
    }
  }

  /**
   * Legacy write path — directly on the main repo.
   * Requires a clean working tree. Used when worktree is unavailable.
   */
  private async _writeViaMainRepo(path: string, content: string, message: string, branch?: string): Promise<void> {
    if (!this.legacyWarned) {
      console.warn('[LocalGitAdapter] Running without worktree isolation — writes require clean working tree');
      this.legacyWarned = true;
    }

    const targetBranch = this.safeRef(branch ?? (await this.getDefaultBranch()));
    const originalBranch = await this.getCurrentBranch();

    // Assert working tree is clean before checkout
    const status = await this.git.status();
    if (!status.isClean()) {
      throw new Error('Working tree is not clean; cannot write file (no worktree available)');
    }

    await this.git.checkout(targetBranch);

    try {
      const fullPath = this.safePath(path);
      await mkdir(dirname(fullPath), { recursive: true });
      await writeFile(fullPath, content, 'utf-8');

      await this.git.add(path);
      await this.git.commit(message);

      try {
        await this.git.push('origin', targetBranch);
      } catch (pushErr) {
        const msg = pushErr instanceof Error ? pushErr.message : String(pushErr);
        if (msg.includes('non-fast-forward') || msg.includes('rejected')) {
          try {
            await this.git.reset(['--hard', `origin/${targetBranch}`]);
          } catch {
            // Best-effort reset
          }
          throw new ConflictError(`Push rejected: non-fast-forward conflict on ${path}`);
        }
        throw pushErr;
      }
    } finally {
      try {
        await this.git.checkout(originalBranch);
      } catch {
        // Ignore checkout errors during cleanup
      }
    }
  }

  async getCommitsBehind(branch: string, baseBranch: string): Promise<number> {
    try {
      const safeB = this.safeRef(branch);
      const safeBase = this.safeRef(baseBranch);
      const output = await this.git.raw(['rev-list', '--count', `${safeB}..${safeBase}`]);
      return parseInt(output.trim(), 10) || 0;
    } catch {
      return 0;
    }
  }

  async getLastCommitDate(branch: string): Promise<string | null> {
    try {
      const safeB = this.safeRef(branch);
      const output = await this.git.raw(['log', '-1', '--format=%cI', safeB]);
      const trimmed = output.trim();
      return trimmed || null;
    } catch {
      return null;
    }
  }

  async fetchOrigin(): Promise<void> {
    try {
      await this.git.fetch('origin');
    } catch {
      // Best-effort — remote may not exist (e.g., local-only repo)
    }
  }

  async getGitIdentity(): Promise<GitIdentity> {
    try {
      const name = (await this.git.raw(['config', 'user.name']).catch(() => '')).trim() || null;
      const email = (await this.git.raw(['config', 'user.email']).catch(() => '')).trim() || null;
      return { name, email };
    } catch {
      return { name: null, email: null };
    }
  }

  async getRepoStatus(): Promise<RepoStatus> {
    try {
      const status = await this.git.status();
      return {
        clean: status.isClean(),
        modified: status.modified.length + status.renamed.length,
        untracked: status.not_added.length,
        staged: status.staged.length,
        conflicted: status.conflicted.length > 0,
        conflictedFiles: status.conflicted,
        worktreeActive: this.worktreeManager?.isReady() ?? false,
      };
    } catch {
      return {
        clean: true,
        modified: 0,
        untracked: 0,
        staged: 0,
        conflicted: false,
        conflictedFiles: [],
        worktreeActive: this.worktreeManager?.isReady() ?? false,
      };
    }
  }

  private async listFromGit(path: string, ref: string): Promise<DirectoryEntry[]> {
    const treePath = path.endsWith('/') ? path : `${path}/`;
    const output = await this.git.raw(['ls-tree', ref, treePath]);
    if (!output.trim()) return [];

    return output
      .trim()
      .split('\n')
      .map((line) => {
        const [meta, filePath] = line.split('\t');
        const type = meta.split(/\s+/)[1];
        const name = filePath.split('/').pop() ?? filePath;
        return {
          name,
          type: type === 'tree' ? 'directory' as const : 'file' as const,
          path: filePath,
        };
      });
  }
}
