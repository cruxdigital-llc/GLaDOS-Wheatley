/**
 * Remote Poller
 *
 * Polls the GitHub API for ref changes on a configurable interval.
 * Uses GitAdapter.getLatestSha() to detect branch HEAD changes.
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
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastSha: string | null = null;
  private running = false;

  constructor(options: RemotePollerOptions) {
    this.adapter = options.adapter;
    this.branch = options.branch;
    this.intervalMs = options.intervalMs ?? 30_000;
    this.onChangeCallback = options.onChange;
  }

  start(): void {
    this.stop();
    this.running = true;
    void this.pollLoop();
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /**
   * Sequential poll loop using setTimeout chaining.
   * Prevents overlapping polls when network is slow.
   */
  private async pollLoop(): Promise<void> {
    if (!this.running) return;

    await this.poll();

    if (this.running) {
      this.timer = setTimeout(() => void this.pollLoop(), this.intervalMs);
    }
  }

  private async poll(): Promise<void> {
    try {
      const branch = this.branch ?? (await this.adapter.getDefaultBranch());
      const sha = await this.adapter.getLatestSha(branch);

      if (this.lastSha !== null && sha !== null && sha !== this.lastSha) {
        this.onChangeCallback();
      }

      if (sha !== null) {
        this.lastSha = sha;
      }
    } catch {
      // Will retry on next poll interval
    }
  }
}
