/**
 * Local Git Adapter
 *
 * Reads from a filesystem-mounted git repository using simple-git and fs.
 * Used in Docker sidecar mode (WHEATLEY_MODE=local).
 */

import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import simpleGit, { type SimpleGit } from 'simple-git';
import type { GitAdapter, DirectoryEntry } from './types.js';

/** Validate ref strings to prevent command-line injection. */
const SAFE_REF_RE = /^[a-zA-Z0-9_./-]+$/;

export class LocalGitAdapter implements GitAdapter {
  private readonly git: SimpleGit;
  private readonly repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = resolve(repoPath);
    this.git = simpleGit(this.repoPath);
  }

  /** Resolve a path within the repo, preventing path traversal attacks. */
  private safePath(path: string): string {
    const resolved = resolve(this.repoPath, path);
    if (!resolved.startsWith(this.repoPath)) {
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

  async readFile(path: string, ref?: string): Promise<string | null> {
    try {
      if (!ref) {
        // Read from working tree
        return await readFile(this.safePath(path), 'utf-8');
      }

      // Explicit ref — always use git show for committed content
      const safeRef = this.safeRef(ref);
      return await this.git.show([`${safeRef}:${path}`]);
    } catch {
      return null;
    }
  }

  async listDirectory(path: string, ref?: string): Promise<DirectoryEntry[]> {
    try {
      if (!ref) {
        // Read from working tree
        return await this.listFromFilesystem(path);
      }

      // Explicit ref — always use git ls-tree for committed content
      const safeRef = this.safeRef(ref);
      return await this.listFromGit(path, safeRef);
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
      // Try to read the remote's default branch
      const ref = await this.git.raw(['symbolic-ref', 'refs/remotes/origin/HEAD']);
      return ref.trim().replace('refs/remotes/origin/', '');
    } catch {
      // Fallback: guess from available branches
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

  private async listFromFilesystem(path: string): Promise<DirectoryEntry[]> {
    const fullPath = this.safePath(path);
    const entries = await readdir(fullPath, { withFileTypes: true });
    return entries.map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? 'directory' as const : 'file' as const,
      path: path ? `${path}/${entry.name}` : entry.name,
    }));
  }

  private async listFromGit(path: string, ref: string): Promise<DirectoryEntry[]> {
    const treePath = path.endsWith('/') ? path : `${path}/`;
    const output = await this.git.raw(['ls-tree', ref, treePath]);
    if (!output.trim()) return [];

    // ls-tree output format: <mode> <type> <hash>\t<path>
    return output
      .trim()
      .split('\n')
      .map((line) => {
        const [meta, filePath] = line.split('\t');
        const type = meta.split(/\s+/)[1]; // 'blob' or 'tree'
        const name = filePath.split('/').pop() ?? filePath;
        return {
          name,
          type: type === 'tree' ? 'directory' as const : 'file' as const,
          path: filePath,
        };
      });
  }
}
