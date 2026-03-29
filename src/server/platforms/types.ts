/**
 * Platform Abstraction Types
 *
 * Unified interface for PR/MR operations across GitHub, GitLab, etc.
 */

export type PRState = 'open' | 'draft' | 'merged' | 'closed';
export type CheckStatus = 'passing' | 'failing' | 'pending' | 'unknown';
export type MergeStrategy = 'merge' | 'squash' | 'rebase';

export interface PRReviewer {
  name: string;
  state: 'approved' | 'changes_requested' | 'pending' | 'commented';
}

export interface PullRequest {
  id: number;
  number: number;
  title: string;
  description: string;
  state: PRState;
  url: string;
  sourceBranch: string;
  targetBranch: string;
  author: string;
  reviewers: PRReviewer[];
  checkStatus: CheckStatus;
  createdAt: string;
  updatedAt: string;
  mergedAt?: string;
}

export interface CreatePRInput {
  title: string;
  description: string;
  sourceBranch: string;
  targetBranch: string;
  draft?: boolean;
}

export interface PlatformAdapter {
  /** List PRs for a given feature branch (by source branch name). */
  listPRs(sourceBranch?: string): Promise<PullRequest[]>;

  /** Get a single PR by number. */
  getPR(number: number): Promise<PullRequest | null>;

  /** Create a new PR. */
  createPR(input: CreatePRInput): Promise<PullRequest>;

  /** Request review from users. */
  requestReview(prNumber: number, reviewers: string[]): Promise<void>;

  /** Merge a PR with the given strategy. */
  mergePR(prNumber: number, strategy: MergeStrategy): Promise<void>;

  /** Get CI/check status for a branch or PR. */
  getCheckStatus(ref: string): Promise<CheckStatus>;

  /** Platform name for display. */
  readonly platform: 'github' | 'gitlab' | 'none';
}
