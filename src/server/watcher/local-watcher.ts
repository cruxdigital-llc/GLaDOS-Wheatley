/**
 * Local File Watcher
 *
 * Watches .git/HEAD and .git/refs/heads/ for filesystem changes.
 * Used in Docker sidecar mode (WHEATLEY_MODE=local).
 */

import { watch, type FSWatcher } from 'node:fs';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { SourceWatcher } from './types.js';

export class LocalFileWatcher implements SourceWatcher {
  private readonly repoPath: string;
  private watchers: FSWatcher[] = [];
  private onChangeCallback: (() => void) | null = null;

  constructor(repoPath: string, onChange: () => void) {
    this.repoPath = repoPath;
    this.onChangeCallback = onChange;
  }

  start(): void {
    this.stop(); // Clean up any existing watchers

    const gitDir = join(this.repoPath, '.git');
    if (!existsSync(gitDir)) {
      return; // Not a git repo — nothing to watch
    }

    // Watch .git/HEAD for branch switches
    const headPath = join(gitDir, 'HEAD');
    if (existsSync(headPath)) {
      try {
        const watcher = watch(headPath, () => {
          this.onChangeCallback?.();
        });
        this.watchers.push(watcher);
      } catch {
        // Silently ignore watch errors
      }
    }

    // Watch .git/refs/heads/ for new commits
    const refsPath = join(gitDir, 'refs', 'heads');
    if (existsSync(refsPath)) {
      try {
        const watcher = watch(refsPath, { recursive: true }, () => {
          this.onChangeCallback?.();
        });
        this.watchers.push(watcher);
      } catch {
        // Silently ignore watch errors
      }
    }
  }

  stop(): void {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
  }
}
