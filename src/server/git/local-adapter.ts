/**
 * Local Git Adapter
 *
 * Reads from a filesystem-mounted git repository using simple-git and fs.
 * Used in Docker sidecar mode (WHEATLEY_MODE=local).
 */

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import simpleGit, { type SimpleGit } from 'simple-git';
import type { GitAdapter, DirectoryEntry } from './types.js';

export class LocalGitAdapter implements GitAdapter {
  private readonly git: SimpleGit;
  private readonly repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath);
  }

  async readFile(path: string, ref?: string): Promise<string | null> {
    try {
      if (!ref) {
        // Read from working tree
        return await readFile(join(this.repoPath, path), 'utf-8');
      }

      const currentBranch = await this.getCurrentBranch();
      if (ref === currentBranch) {
        // Same as current branch — read from working tree
        return await readFile(join(this.repoPath, path), 'utf-8');
      }

      // Different ref — use git show
      return await this.git.show([`${ref}:${path}`]);
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

      const currentBranch = await this.getCurrentBranch();
      if (ref === currentBranch) {
        return await this.listFromFilesystem(path);
      }

      // Different ref — use git ls-tree
      return await this.listFromGit(path, ref);
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
      const branches = await this.listBranches();
      if (branches.includes('main')) return 'main';
      if (branches.includes('master')) return 'master';
      return branches[0] ?? 'main';
    } catch {
      return 'main';
    }
  }

  private async listFromFilesystem(path: string): Promise<DirectoryEntry[]> {
    const fullPath = join(this.repoPath, path);
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
