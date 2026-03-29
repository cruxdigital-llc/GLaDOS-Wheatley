/**
 * GitLab Platform Adapter
 *
 * Implements PlatformAdapter using the GitLab REST API via fetch.
 *
 * Environment variables:
 *   GITLAB_TOKEN       — Personal or project access token
 *   GITLAB_PROJECT_ID  — Numeric project ID
 *   GITLAB_API_URL     — Base URL (default: https://gitlab.com/api/v4)
 */

import type {
  PlatformAdapter,
  PullRequest,
  CreatePRInput,
  MergeStrategy,
  CheckStatus,
  PRState,
} from './types.js';

export class GitLabAdapter implements PlatformAdapter {
  readonly platform = 'gitlab' as const;

  private readonly baseUrl: string;
  private readonly token: string;
  private readonly projectId: string;

  constructor() {
    this.baseUrl = (process.env['GITLAB_API_URL'] ?? 'https://gitlab.com/api/v4').replace(/\/+$/, '');
    this.token = process.env['GITLAB_TOKEN'] ?? '';
    this.projectId = process.env['GITLAB_PROJECT_ID'] ?? '';
    if (!this.projectId) {
      throw new Error('GITLAB_PROJECT_ID is required');
    }
  }

  /* ------------------------------------------------------------------ */
  /*  HTTP helpers                                                       */
  /* ------------------------------------------------------------------ */

  private headers(): Record<string, string> {
    return {
      'PRIVATE-TOKEN': this.token,
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
      throw new Error(`GitLab API ${method} ${path} failed (${resp.status}): ${text}`);
    }
    if (resp.status === 204) return null;
    return (await resp.json()) as T;
  }

  /* ------------------------------------------------------------------ */
  /*  Mapping helpers                                                    */
  /* ------------------------------------------------------------------ */

  /* eslint-disable @typescript-eslint/no-explicit-any */
  private mapMR(raw: any): PullRequest {
    let state: PRState = 'open';
    if (raw.state === 'merged') {
      state = 'merged';
    } else if (raw.state === 'closed') {
      state = 'closed';
    } else if (raw.work_in_progress || raw.draft) {
      state = 'draft';
    }

    return {
      id: raw.id,
      number: raw.iid,
      title: raw.title ?? '',
      description: raw.description ?? '',
      state,
      url: raw.web_url ?? '',
      sourceBranch: raw.source_branch ?? '',
      targetBranch: raw.target_branch ?? '',
      author: raw.author?.username ?? '',
      reviewers: (raw.reviewers ?? []).map((r: any) => ({
        name: r.username ?? '',
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
    let path = `/projects/${encodeURIComponent(this.projectId)}/merge_requests?state=all&per_page=100`;
    if (sourceBranch) {
      path += `&source_branch=${encodeURIComponent(sourceBranch)}`;
    }
    const raw = await this.request<unknown[]>('GET', path);
    if (!raw) return [];
    return raw.map((mr) => this.mapMR(mr));
  }

  async getPR(number: number): Promise<PullRequest | null> {
    const raw = await this.request<unknown>(
      'GET',
      `/projects/${encodeURIComponent(this.projectId)}/merge_requests/${number}`,
    );
    if (!raw) return null;

    const mr = this.mapMR(raw);

    // Fetch pipeline status
    mr.checkStatus = await this.getCheckStatus(mr.sourceBranch);

    return mr;
  }

  async createPR(input: CreatePRInput): Promise<PullRequest> {
    const raw = await this.request<unknown>(
      'POST',
      `/projects/${encodeURIComponent(this.projectId)}/merge_requests`,
      {
        title: input.draft ? `Draft: ${input.title}` : input.title,
        description: input.description,
        source_branch: input.sourceBranch,
        target_branch: input.targetBranch,
      },
    );
    if (!raw) throw new Error('Failed to create MR — unexpected empty response');
    return this.mapMR(raw);
  }

  async requestReview(prNumber: number, reviewers: string[]): Promise<void> {
    // GitLab requires numeric user IDs for reviewers; we don't resolve usernames here.
    console.warn(
      `[GitLabAdapter] requestReview: cannot resolve usernames to IDs. ` +
        `Requested reviewers for MR !${prNumber}: ${reviewers.join(', ')}`,
    );
  }

  async mergePR(prNumber: number, strategy: MergeStrategy): Promise<void> {
    const body: Record<string, unknown> = {};
    if (strategy === 'squash') {
      body['squash'] = true;
    }
    // GitLab doesn't have a direct "rebase" merge method on the merge endpoint;
    // "rebase" is handled via merge_method project setting. We pass squash when needed.
    await this.request<unknown>(
      'PUT',
      `/projects/${encodeURIComponent(this.projectId)}/merge_requests/${prNumber}/merge`,
      body,
    );
  }

  async getCheckStatus(ref: string): Promise<CheckStatus> {
    const raw = await this.request<Array<{ status?: string }>>(
      'GET',
      `/projects/${encodeURIComponent(this.projectId)}/pipelines?ref=${encodeURIComponent(ref)}&per_page=1`,
    );
    if (!raw || raw.length === 0) return 'unknown';

    const latest = raw[0];
    switch (latest.status) {
      case 'success':
        return 'passing';
      case 'failed':
      case 'canceled':
        return 'failing';
      case 'running':
      case 'pending':
      case 'created':
        return 'pending';
      default:
        return 'unknown';
    }
  }
}
