/**
 * Remote Git Adapter
 *
 * Reads from a GitHub repository via the REST API using Octokit.
 * Used in cloud mode (WHEATLEY_MODE=remote).
 */

import { Octokit } from '@octokit/rest';
import type { GitAdapter, DirectoryEntry, GitHubConfig, RepoStatus, GitIdentity } from './types.js';
import { ConflictError } from './types.js';

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
      const MAX_PAGES = 10; // Cap at 1,000 branches to avoid rate limit exhaustion

      while (page <= MAX_PAGES) {
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

  async writeFile(path: string, content: string, message: string, branch?: string): Promise<void> {
    const targetBranch = branch ?? (await this.getDefaultBranch());

    // Read the current file SHA (needed for updates; omit for new files)
    let sha: string | undefined;
    try {
      const response = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
        ref: targetBranch,
      });
      const data = response.data;
      if (!Array.isArray(data) && data.type === 'file') {
        sha = data.sha;
      }
    } catch {
      // File does not exist yet — proceed with sha undefined
    }

    try {
      await this.octokit.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        path,
        message,
        content: Buffer.from(content).toString('base64'),
        branch: targetBranch,
        ...(sha !== undefined ? { sha } : {}),
      });
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 409) {
        throw new ConflictError(`GitHub API returned 409: conflict on ${path}`);
      }
      if (status === 422) {
        throw new ConflictError(`GitHub API returned 422: conflict on ${path}`);
      }
      throw err;
    }
  }

  async deleteFiles(paths: string[], message: string, branch?: string): Promise<void> {
    const targetBranch = branch ?? (await this.getDefaultBranch());

    for (const path of paths) {
      // Get the current file SHA (required for deletion)
      let sha: string | undefined;
      try {
        const response = await this.octokit.repos.getContent({
          owner: this.owner,
          repo: this.repo,
          path,
          ref: targetBranch,
        });
        const data = response.data;
        if (!Array.isArray(data) && data.type === 'file') {
          sha = data.sha;
        }
      } catch {
        // File doesn't exist — skip
        continue;
      }

      if (!sha) continue;

      try {
        await this.octokit.repos.deleteFile({
          owner: this.owner,
          repo: this.repo,
          path,
          message,
          sha,
          branch: targetBranch,
        });
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status === 409 || status === 422) {
          throw new ConflictError(`GitHub API conflict on delete ${path}`);
        }
        throw err;
      }
    }
  }

  async getCommitsBehind(branch: string, baseBranch: string): Promise<number> {
    try {
      const response = await this.octokit.repos.compareCommits({
        owner: this.owner,
        repo: this.repo,
        base: branch,
        head: baseBranch,
      });
      return response.data.ahead_by ?? 0;
    } catch {
      return 0;
    }
  }

  async getLastCommitDate(branch: string): Promise<string | null> {
    try {
      const response = await this.octokit.repos.getBranch({
        owner: this.owner,
        repo: this.repo,
        branch,
      });
      return response.data.commit.commit.committer?.date ?? null;
    } catch {
      return null;
    }
  }

  async fetchOrigin(): Promise<void> {
    // Remote adapter reads via API — no fetch needed
  }

  async getGitIdentity(): Promise<GitIdentity> {
    // Remote mode has no local git config — identity comes from GitHub token
    return { name: null, email: null };
  }

  async getRepoStatus(): Promise<RepoStatus> {
    // Remote repos have no working tree — always report clean
    return {
      clean: true,
      modified: 0,
      untracked: 0,
      staged: 0,
      conflicted: false,
      conflictedFiles: [],
      worktreeActive: false,
      pushOnWrite: true,
      unpushedCommits: 0,
    };
  }

  async getLatestSha(branch?: string): Promise<string | null> {
    try {
      const ref = branch ?? (await this.getDefaultBranch());
      const response = await this.octokit.repos.getBranch({
        owner: this.owner,
        repo: this.repo,
        branch: ref,
      });
      return response.data.commit.sha;
    } catch {
      return null;
    }
  }
}
