/**
 * GitHub Platform Adapter
 *
 * Implements PlatformAdapter using the GitHub REST API via fetch.
 *
 * Environment variables:
 *   GITHUB_TOKEN       — Personal access token or GitHub App token
 *   GITHUB_REPOSITORY  — Owner/repo (e.g. "acme/widgets")
 *   GITHUB_API_URL     — Base URL (default: https://api.github.com)
 */

import type {
  PlatformAdapter,
  PullRequest,
  CreatePRInput,
  MergeStrategy,
  CheckStatus,
  PRState,
  PRReviewer,
} from './types.js';

export class GitHubAdapter implements PlatformAdapter {
  readonly platform = 'github' as const;

  private readonly baseUrl: string;
  private readonly token: string;
  private readonly owner: string;
  private readonly repo: string;

  constructor() {
    const rawUrl = (process.env['GITHUB_API_URL'] ?? 'https://api.github.com').replace(/\/+$/, '');
    // Validate URL: must be HTTPS
    if (!rawUrl.startsWith('https://')) {
      throw new Error('GITHUB_API_URL must use HTTPS');
    }
    this.baseUrl = rawUrl;

    const token = process.env['GITHUB_TOKEN'] ?? '';
    if (!token) {
      throw new Error('GITHUB_TOKEN is required and must be non-empty');
    }
    this.token = token;

    const repository = process.env['GITHUB_REPOSITORY'] ?? '';
    const parts = repository.split('/');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new Error('GITHUB_REPOSITORY must be in "owner/repo" format');
    }
    this.owner = parts[0];
    this.repo = parts[1];
  }

  /* ------------------------------------------------------------------ */
  /*  HTTP helpers                                                       */
  /* ------------------------------------------------------------------ */

  private headers(): Record<string, string> {
    return {
      Authorization: `token ${this.token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T | null> {
    const url = `${this.baseUrl}${path}`;
    const resp = await fetch(url, {
      method,
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    });

    if (resp.status === 404) return null;
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`GitHub API ${method} ${path} failed (${resp.status}): ${text}`);
    }
    if (resp.status === 204) return null;
    return (await resp.json()) as T;
  }

  /* ------------------------------------------------------------------ */
  /*  Mapping helpers                                                    */
  /* ------------------------------------------------------------------ */

  /* eslint-disable @typescript-eslint/no-explicit-any */
  private mapPR(raw: any): PullRequest {
    let state: PRState = 'open';
    if (raw.merged_at) {
      state = 'merged';
    } else if (raw.state === 'closed') {
      state = 'closed';
    } else if (raw.draft) {
      state = 'draft';
    }

    return {
      id: raw.id,
      number: raw.number,
      title: raw.title ?? '',
      description: raw.body ?? '',
      state,
      url: raw.html_url ?? '',
      sourceBranch: raw.head?.ref ?? '',
      targetBranch: raw.base?.ref ?? '',
      author: raw.user?.login ?? '',
      reviewers: (raw.requested_reviewers ?? []).map((r: any) => ({
        name: r.login ?? '',
        state: 'pending' as const,
      })),
      checkStatus: 'unknown',
      createdAt: raw.created_at ?? '',
      updatedAt: raw.updated_at ?? '',
      mergedAt: raw.merged_at ?? undefined,
    };
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  /* ------------------------------------------------------------------ */
  /*  PlatformAdapter methods                                            */
  /* ------------------------------------------------------------------ */

  async listPRs(sourceBranch?: string): Promise<PullRequest[]> {
    let path = `/repos/${this.owner}/${this.repo}/pulls?state=all&per_page=100`;
    if (sourceBranch) {
      path += `&head=${encodeURIComponent(`${this.owner}:${sourceBranch}`)}`;
    }
    const raw = await this.request<unknown[]>('GET', path);
    if (!raw) return [];
    return raw.map((pr) => this.mapPR(pr));
  }

  async getPR(number: number): Promise<PullRequest | null> {
    const raw = await this.request<unknown>('GET', `/repos/${this.owner}/${this.repo}/pulls/${number}`);
    if (!raw) return null;

    const pr = this.mapPR(raw);

    // Fetch reviews to populate reviewer states
    const reviews = await this.request<unknown[]>(
      'GET',
      `/repos/${this.owner}/${this.repo}/pulls/${number}/reviews`,
    );
    if (reviews && reviews.length > 0) {
      const reviewerMap = new Map<string, PRReviewer>();
      for (const rev of reviews as Array<{ user?: { login?: string }; state?: string }>) {
        const name = rev.user?.login ?? '';
        if (!name) continue;
        reviewerMap.set(name, {
          name,
          state: this.mapReviewState(rev.state ?? ''),
        });
      }
      // Merge with requested reviewers (pending)
      for (const existing of pr.reviewers) {
        if (!reviewerMap.has(existing.name)) {
          reviewerMap.set(existing.name, existing);
        }
      }
      pr.reviewers = Array.from(reviewerMap.values());
    }

    // Fetch check status
    pr.checkStatus = await this.getCheckStatus(pr.sourceBranch);

    return pr;
  }

  async createPR(input: CreatePRInput): Promise<PullRequest> {
    const raw = await this.request<unknown>('POST', `/repos/${this.owner}/${this.repo}/pulls`, {
      title: input.title,
      body: input.description,
      head: input.sourceBranch,
      base: input.targetBranch,
      draft: input.draft ?? false,
    });
    if (!raw) throw new Error('Failed to create PR — unexpected empty response');
    return this.mapPR(raw);
  }

  async requestReview(prNumber: number, reviewers: string[]): Promise<void> {
    await this.request<unknown>(
      'POST',
      `/repos/${this.owner}/${this.repo}/pulls/${prNumber}/requested_reviewers`,
      { reviewers },
    );
  }

  async mergePR(prNumber: number, strategy: MergeStrategy): Promise<void> {
    await this.request<unknown>(
      'PUT',
      `/repos/${this.owner}/${this.repo}/pulls/${prNumber}/merge`,
      { merge_method: strategy },
    );
  }

  async getCheckStatus(ref: string): Promise<CheckStatus> {
    const raw = await this.request<{ check_runs?: Array<{ conclusion?: string; status?: string }> }>(
      'GET',
      `/repos/${this.owner}/${this.repo}/commits/${encodeURIComponent(ref)}/check-runs`,
    );
    if (!raw || !raw.check_runs || raw.check_runs.length === 0) return 'unknown';

    const runs = raw.check_runs;
    const allCompleted = runs.every((r) => r.status === 'completed');
    if (!allCompleted) return 'pending';

    const anyFailure = runs.some(
      (r) => r.conclusion === 'failure' || r.conclusion === 'timed_out' || r.conclusion === 'cancelled',
    );
    if (anyFailure) return 'failing';

    return 'passing';
  }

  /* ------------------------------------------------------------------ */
  /*  Private helpers                                                    */
  /* ------------------------------------------------------------------ */

  private mapReviewState(state: string): PRReviewer['state'] {
    switch (state.toUpperCase()) {
      case 'APPROVED':
        return 'approved';
      case 'CHANGES_REQUESTED':
        return 'changes_requested';
      case 'COMMENTED':
        return 'commented';
      default:
        return 'pending';
    }
  }
}
