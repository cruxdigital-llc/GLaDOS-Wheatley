/**
 * Repo Status Indicator
 *
 * Shows working tree state (clean/dirty) and merge conflict warnings
 * in the board header. When conflicts are detected, displays a banner
 * with affected file paths and blocks writes until resolved.
 */

import React, { useState } from 'react';
import { useRepoStatus } from '../hooks/use-board.js';

export function RepoStatusIndicator() {
  const { data: status } = useRepoStatus();
  const [expanded, setExpanded] = useState(false);

  if (!status) return null;

  // Conflict banner takes priority
  if (status.conflicted) {
    return (
      <div className="w-full">
        <div className="bg-red-50 border border-red-300 rounded px-3 py-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="font-medium text-red-800">
              Merge conflict — {status.conflictedFiles.length} file{status.conflictedFiles.length !== 1 ? 's' : ''}
            </span>
            <span className="text-red-600">Writes blocked until resolved.</span>
            <button
              type="button"
              onClick={() => setExpanded(v => !v)}
              className="ml-auto text-red-700 underline text-xs"
            >
              {expanded ? 'Hide' : 'Show files'}
            </button>
          </div>
          {expanded && (
            <ul className="mt-2 text-xs text-red-700 font-mono space-y-0.5 pl-4">
              {status.conflictedFiles.map(f => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
          <p className="text-xs text-red-600 mt-1">
            Resolve conflicts in your editor, then <code className="bg-red-100 px-1 rounded">git add</code> the fixed files.
          </p>
        </div>
      </div>
    );
  }

  // Dirty state indicator (compact)
  if (!status.clean) {
    const parts: string[] = [];
    if (status.modified > 0) parts.push(`${status.modified} modified`);
    if (status.untracked > 0) parts.push(`${status.untracked} untracked`);
    if (status.staged > 0) parts.push(`${status.staged} staged`);

    return (
      <div className="flex items-center gap-1.5 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-1">
        <span className="inline-block w-2 h-2 rounded-full bg-yellow-400" />
        <span>Repo has uncommitted changes ({parts.join(', ')})</span>
        {status.worktreeActive && (
          <span className="text-yellow-500 ml-1" title="Worktree isolation active — writes are safe">
            (worktree OK)
          </span>
        )}
      </div>
    );
  }

  // Clean state — show a subtle green dot
  return (
    <div className="flex items-center gap-1.5 text-xs text-green-600">
      <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
      <span>Clean</span>
      {status.worktreeActive && (
        <span className="text-green-400 ml-1" title="Worktree isolation active">
          (worktree)
        </span>
      )}
    </div>
  );
}
