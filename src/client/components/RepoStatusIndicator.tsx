/**
 * Repo Status Indicator
 *
 * Shows working tree state (clean/dirty), merge conflict warnings,
 * unpushed commit count with Push button, and GPG warnings.
 */

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRepoStatus } from '../hooks/use-board.js';
import { pushToOrigin } from '../api.js';

export function RepoStatusIndicator() {
  const { data: status } = useRepoStatus();
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();

  const pushMutation = useMutation({
    mutationFn: pushToOrigin,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['repo', 'status'] });
    },
  });

  if (!status) return null;

  // Conflict banner takes priority
  if (status.conflicted) {
    return (
      <div className="w-full">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded px-3 py-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="font-medium text-red-800 dark:text-red-300">
              Merge conflict — {status.conflictedFiles.length} file{status.conflictedFiles.length !== 1 ? 's' : ''}
            </span>
            <span className="text-red-600 dark:text-red-400">Writes blocked until resolved.</span>
            <button
              type="button"
              onClick={() => setExpanded(v => !v)}
              className="ml-auto text-red-700 dark:text-red-400 underline text-xs"
            >
              {expanded ? 'Hide' : 'Show files'}
            </button>
          </div>
          {expanded && (
            <ul className="mt-2 text-xs text-red-700 dark:text-red-400 font-mono space-y-0.5 pl-4">
              {status.conflictedFiles.map(f => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
            Resolve conflicts in your editor, then <code className="bg-red-100 dark:bg-red-900 px-1 rounded">git add</code> the fixed files.
          </p>
        </div>
      </div>
    );
  }

  // Build status parts
  const parts: string[] = [];
  if (!status.clean) {
    if (status.modified > 0) parts.push(`${status.modified} modified`);
    if (status.untracked > 0) parts.push(`${status.untracked} untracked`);
    if (status.staged > 0) parts.push(`${status.staged} staged`);
  }

  const hasUnpushed = !status.pushOnWrite && status.unpushedCommits > 0;
  const showDirty = !status.clean;
  const showIndicator = showDirty || hasUnpushed || status.gpgWarning;

  if (!showIndicator) {
    // Clean state with no unpushed commits
    return (
      <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
        <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
        <span>Clean</span>
        {status.worktreeActive && (
          <span className="text-green-400 dark:text-green-500 ml-1" title="Worktree isolation active">
            (worktree)
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Dirty state */}
      {showDirty && (
        <div className="flex items-center gap-1.5 text-xs text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded px-2 py-1">
          <span className="inline-block w-2 h-2 rounded-full bg-yellow-400" />
          <span>Repo has uncommitted changes ({parts.join(', ')})</span>
          {status.worktreeActive && (
            <span className="text-yellow-500 dark:text-yellow-400 ml-1" title="Worktree isolation active — writes are safe">
              (worktree OK)
            </span>
          )}
        </div>
      )}

      {/* Unpushed commits */}
      {hasUnpushed && (
        <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded px-2 py-1">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
          <span>
            {status.unpushedCommits} unpushed commit{status.unpushedCommits !== 1 ? 's' : ''}
          </span>
          <button
            type="button"
            onClick={() => pushMutation.mutate()}
            disabled={pushMutation.isPending}
            className="ml-1 px-2 py-0.5 rounded bg-amber-600 text-white text-xs hover:bg-amber-700 disabled:opacity-50 transition-colors"
          >
            {pushMutation.isPending ? 'Pushing...' : 'Push'}
          </button>
        </div>
      )}

      {/* Push error */}
      {pushMutation.isError && (
        <div className="text-xs text-red-600 dark:text-red-400">
          {(pushMutation.error as Error)?.message ?? 'Push failed'}
        </div>
      )}

      {/* Push success */}
      {pushMutation.isSuccess && pushMutation.data?.pushed && (
        <div className="text-xs text-green-600 dark:text-green-400">
          Pushed {pushMutation.data.commits} commit{pushMutation.data.commits !== 1 ? 's' : ''}
        </div>
      )}

      {/* GPG warning */}
      {status.gpgWarning && (
        <div className="flex items-center gap-1.5 text-xs text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded px-2 py-1" title={status.gpgWarning}>
          <span>GPG signing required but not configured</span>
        </div>
      )}
    </div>
  );
}
