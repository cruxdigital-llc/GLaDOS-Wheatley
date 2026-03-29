/**
 * Remote Git Adapter
 *
 * Reads from a GitHub repository via the REST API using Octokit.
 * Used in cloud mode (WHEATLEY_MODE=remote).
 */

import { Octokit } from '@octokit/rest';
import type { GitAdapter, DirectoryEntry, GitHubConfig } from './types.js';

export class RemoteGitAdapter implements GitAdapter {
  private readonly octokit: Octokit;
  private readonly owner: string;
  private readonly repo: string;
  private defaultBranchCache: string | null = null;

  constructor(config: GitHubConfig) {
    this.owner = config.owner;
    this.repo = config.repo;
    this.octokit = new Octokit({ auth: config.token });
  }

  async readFile(path: string, ref?: string): Promise<string | null> {
    try {
      const resolvedRef = ref ?? (await this.getDefaultBranch());
      const response = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
        ref: resolvedRef,
      });

      const data = response.data;
      if (Array.isArray(data) || data.type !== 'file') {
        return null;
      }

      // Content is base64-encoded
      return Buffer.from(data.content, 'base64').toString('utf-8');
    } catch {
      return null;
    }
  }

  async listDirectory(path: string, ref?: string): Promise<DirectoryEntry[]> {
    try {
      const resolvedRef = ref ?? (await this.getDefaultBranch());
      const response = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
        ref: resolvedRef,
      });

      const data = response.data;
      if (!Array.isArray(data)) {
        return [];
      }

      return data.map((entry) => ({
        name: entry.name,
        type: entry.type === 'dir' ? 'directory' as const : 'file' as const,
        path: entry.path,
      }));
    } catch {
      return [];
    }
  }

  async listBranches(): Promise<string[]> {
    try {
      const branches: string[] = [];
      let page = 1;

      // Paginate to get all branches
      while (true) {
        const response = await this.octokit.repos.listBranches({
          owner: this.owner,
          repo: this.repo,
          per_page: 100,
          page,
        });

        branches.push(...response.data.map((b) => b.name));

        if (response.data.length < 100) break;
        page++;
      }

      return branches;
    } catch {
      return [];
    }
  }

  async getCurrentBranch(): Promise<string> {
    // Remote repos don't have a "current" branch — return default
    return this.getDefaultBranch();
  }

  async getDefaultBranch(): Promise<string> {
    if (this.defaultBranchCache) {
      return this.defaultBranchCache;
    }

    try {
      const response = await this.octokit.repos.get({
        owner: this.owner,
        repo: this.repo,
      });

      this.defaultBranchCache = response.data.default_branch;
      return this.defaultBranchCache;
    } catch {
      return 'main';
    }
  }
}
