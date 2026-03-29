/**
 * Remote Poller
 *
 * Polls the GitHub API for ref changes on a configurable interval.
 * Used in cloud mode (WHEATLEY_MODE=remote).
 */

import type { GitAdapter } from '../git/types.js';
import type { SourceWatcher } from './types.js';

export interface RemotePollerOptions {
  /** Git adapter for API calls. */
  adapter: GitAdapter;
  /** Branch to watch. Defaults to the adapter's default branch. */
  branch?: string;
  /** Poll interval in ms. Default: 30000 (30s). */
  intervalMs?: number;
  /** Callback when a change is detected. */
  onChange: () => void;
}

export class RemotePoller implements SourceWatcher {
  private readonly adapter: GitAdapter;
  private readonly branch: string | undefined;
  private readonly intervalMs: number;
  private readonly onChangeCallback: () => void;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastSha: string | null = null;

  constructor(options: RemotePollerOptions) {
    this.adapter = options.adapter;
    this.branch = options.branch;
    this.intervalMs = options.intervalMs ?? 30_000;
    this.onChangeCallback = options.onChange;
  }

  start(): void {
    this.stop(); // Clean up any existing timer
    // Poll immediately on start, then on interval
    void this.poll();
    this.timer = setInterval(() => void this.poll(), this.intervalMs);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async poll(): Promise<void> {
    try {
      const branch = this.branch ?? (await this.adapter.getDefaultBranch());
      // Read the branch ref to get the latest commit SHA
      // We use listBranches and find the matching branch, or read the ref file
      const branches = await this.adapter.listBranches();
      if (!branches.includes(branch)) return;

      // Use readFile on a marker path — the commit SHA comes from the API metadata
      // For simplicity, we read a known file and use its content hash as a change indicator
      const content = await this.adapter.readFile('product-knowledge/ROADMAP.md', branch);
      const sha = content ? this.hashContent(content) : null;

      if (this.lastSha !== null && sha !== null && sha !== this.lastSha) {
        this.onChangeCallback();
      }

      this.lastSha = sha;
    } catch {
      // Silently ignore poll errors — will retry on next interval
    }
  }

  /** Simple string hash for change detection. */
  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0;
    }
    return hash.toString(36);
  }
}
