/**
 * Repo Manager
 *
 * Manages multiple repository connections.
 * Reads configuration from wheatley.config.json or the WHEATLEY_REPOS env var.
 * Falls back to single-repo mode when no multi-repo config is found.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { GitAdapter } from '../git/types.js';
import { BoardService } from '../api/board-service.js';
import type { RepoConfig, MultiRepoConfig } from './types.js';

export class RepoManager {
  private config: MultiRepoConfig;
  private adapters = new Map<string, GitAdapter>();
  private boardServices = new Map<string, BoardService>();
  private primaryAdapter: GitAdapter;

  constructor(primaryAdapter: GitAdapter) {
    this.primaryAdapter = primaryAdapter;
    this.config = this.loadConfig();
  }

  /**
   * Load multi-repo configuration.
   * Priority: WHEATLEY_REPOS env var > wheatley.config.json > single-repo fallback.
   */
  private loadConfig(): MultiRepoConfig {
    // Try env var first
    const envRepos = process.env['WHEATLEY_REPOS'];
    if (envRepos) {
      try {
        const parsed = JSON.parse(envRepos) as MultiRepoConfig;
        if (parsed && Array.isArray(parsed.repos) && parsed.repos.length > 0) {
          return this.validateConfig(parsed);
        }
      } catch {
        // eslint-disable-next-line no-console
        console.warn('[repo-manager] Failed to parse WHEATLEY_REPOS env var, falling back');
      }
    }

    // Try config file
    try {
      const configPath = resolve(process.cwd(), 'wheatley.config.json');
      const raw = readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(raw) as { repos?: MultiRepoConfig };
      if (parsed.repos && Array.isArray(parsed.repos.repos) && parsed.repos.repos.length > 0) {
        return this.validateConfig(parsed.repos);
      }
    } catch {
      // Config file not found or invalid — not an error, single-repo mode
    }

    // Fallback: single-repo mode using the primary adapter
    return {
      repos: [{ id: 'default', name: 'Default' }],
      defaultRepo: 'default',
    };
  }

  private validateConfig(config: MultiRepoConfig): MultiRepoConfig {
    const repos = config.repos.filter(
      (r) => r && typeof r.id === 'string' && typeof r.name === 'string',
    );
    if (repos.length === 0) {
      return {
        repos: [{ id: 'default', name: 'Default' }],
        defaultRepo: 'default',
      };
    }
    const defaultRepo = repos.some((r) => r.id === config.defaultRepo)
      ? config.defaultRepo
      : repos[0].id;
    return { repos, defaultRepo };
  }

  /** Get a GitAdapter for a specific repo ID. */
  getAdapter(repoId: string): GitAdapter {
    // For the default/primary repo, return the existing adapter
    const repo = this.config.repos.find((r) => r.id === repoId);
    if (!repo) {
      throw new Error(`Unknown repo: ${repoId}`);
    }

    const cached = this.adapters.get(repoId);
    if (cached) return cached;

    // In single-repo mode or for the default repo, use the primary adapter
    if (repoId === 'default' || this.config.repos.length === 1) {
      this.adapters.set(repoId, this.primaryAdapter);
      return this.primaryAdapter;
    }

    // For multi-repo, use the primary adapter as fallback.
    // A full implementation would create adapters from repo.path or repo.remote.
    // eslint-disable-next-line no-console
    console.warn(
      `[repo-manager] No dedicated adapter for repo "${repoId}", using primary adapter`,
    );
    this.adapters.set(repoId, this.primaryAdapter);
    return this.primaryAdapter;
  }

  /** Get a BoardService for a specific repo ID. */
  getBoardService(repoId: string): BoardService {
    const cached = this.boardServices.get(repoId);
    if (cached) return cached;

    const adapter = this.getAdapter(repoId);
    const service = new BoardService(adapter);
    this.boardServices.set(repoId, service);
    return service;
  }

  /** List all configured repos. */
  listRepos(): RepoConfig[] {
    return [...this.config.repos];
  }

  /** Get the default repo ID. */
  getDefault(): string {
    return this.config.defaultRepo;
  }
}
