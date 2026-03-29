/**
 * Null Platform Adapter
 *
 * No-op adapter used when no platform (GitHub/GitLab) is configured.
 */

import type {
  PlatformAdapter,
  PullRequest,
  CreatePRInput,
  MergeStrategy,
  CheckStatus,
} from './types.js';

export class NullPlatformAdapter implements PlatformAdapter {
  readonly platform = 'none' as const;

  async listPRs(): Promise<PullRequest[]> {
    return [];
  }

  async getPR(): Promise<PullRequest | null> {
    return null;
  }

  async createPR(_input: CreatePRInput): Promise<PullRequest> {
    throw new Error('No platform configured — cannot create PR');
  }

  async requestReview(_prNumber: number, _reviewers: string[]): Promise<void> {
    throw new Error('No platform configured — cannot request review');
  }

  async mergePR(_prNumber: number, _strategy: MergeStrategy): Promise<void> {
    throw new Error('No platform configured — cannot merge PR');
  }

  async getCheckStatus(_ref: string): Promise<CheckStatus> {
    return 'unknown';
  }
}
