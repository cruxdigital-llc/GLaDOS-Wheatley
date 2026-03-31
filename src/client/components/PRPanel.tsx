/**
 * PR Panel Component
 *
 * Displays linked pull requests for a card, with status badges,
 * reviewer info, and merge actions.
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCardPRs, mergePR } from '../api.js';
import type { PullRequest } from '../api.js';

interface PRPanelProps {
  cardId: string;
}

const STATE_BADGES: Record<PullRequest['state'], { bg: string; text: string; label: string }> = {
  open: { bg: 'bg-green-50', text: 'text-green-700', label: 'Open' },
  draft: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Draft' },
  merged: { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Merged' },
  closed: { bg: 'bg-red-50', text: 'text-red-700', label: 'Closed' },
};

const CHECK_BADGES: Record<PullRequest['checkStatus'], { bg: string; text: string; icon: string }> = {
  passing: { bg: 'bg-green-50', text: 'text-green-700', icon: '\u2713' },
  failing: { bg: 'bg-red-50', text: 'text-red-700', icon: '\u2717' },
  pending: { bg: 'bg-yellow-50', text: 'text-yellow-700', icon: '\u25CB' },
  unknown: { bg: 'bg-gray-100', text: 'text-gray-500', icon: '?' },
};

const REVIEW_ICONS: Record<string, string> = {
  approved: '\u2713',
  changes_requested: '\u2717',
  commented: '\uD83D\uDCAC',
  pending: '\u25CB',
};

function PRItem({ pr }: { pr: PullRequest }) {
  const queryClient = useQueryClient();
  const [mergeStrategy, setMergeStrategy] = useState('squash');
  const [showMerge, setShowMerge] = useState(false);

  const mergeMutation = useMutation({
    mutationFn: () => mergePR(pr.number, mergeStrategy),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['card-prs'] });
      setShowMerge(false);
    },
  });

  const stateBadge = STATE_BADGES[pr.state];
  const checkBadge = CHECK_BADGES[pr.checkStatus];

  return (
    <div className="border border-gray-200 rounded-lg p-3 space-y-2">
      {/* Title row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stateBadge.bg} ${stateBadge.text}`}>
              {stateBadge.label}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${checkBadge.bg} ${checkBadge.text}`}>
              {checkBadge.icon} CI
            </span>
            <span className="text-xs text-gray-400">#{pr.number}</span>
          </div>
          <h4 className="text-sm font-medium text-gray-900 mt-1 leading-tight">{pr.title}</h4>
        </div>
        <a
          href={pr.url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
        >
          View
        </a>
      </div>

      {/* Branch and author info */}
      <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
        <span className="font-mono bg-gray-50 px-1.5 py-0.5 rounded">{pr.sourceBranch}</span>
        <span>&rarr;</span>
        <span className="font-mono bg-gray-50 px-1.5 py-0.5 rounded">{pr.targetBranch}</span>
        <span>&middot;</span>
        <span>{pr.author}</span>
      </div>

      {/* Reviewers */}
      {pr.reviewers.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Reviewers:</span>
          {pr.reviewers.map((r) => (
            <span
              key={r.name}
              className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-gray-50 text-gray-700"
              title={r.state}
            >
              <span>{REVIEW_ICONS[r.state] ?? '\u25CB'}</span>
              {r.name}
            </span>
          ))}
        </div>
      )}

      {/* Merge controls (only for open PRs) */}
      {pr.state === 'open' && (
        <div className="flex items-center gap-2">
          {showMerge ? (
            <>
              <select
                value={mergeStrategy}
                onChange={(e) => setMergeStrategy(e.target.value)}
                className="text-xs border border-gray-300 rounded px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="merge">Merge</option>
                <option value="squash">Squash</option>
                <option value="rebase">Rebase</option>
              </select>
              <button
                type="button"
                onClick={() => mergeMutation.mutate()}
                disabled={mergeMutation.isPending}
                className="text-xs px-3 py-1 rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {mergeMutation.isPending ? 'Merging...' : 'Confirm Merge'}
              </button>
              <button
                type="button"
                onClick={() => setShowMerge(false)}
                className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-500 hover:bg-gray-50"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowMerge(true)}
              className="text-xs px-3 py-1 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200"
            >
              Merge
            </button>
          )}
          {mergeMutation.isError && (
            <span className="text-xs text-red-600">
              {mergeMutation.error instanceof Error ? mergeMutation.error.message : 'Merge failed'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function PRPanel({ cardId }: PRPanelProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['card-prs', cardId],
    queryFn: () => fetchCardPRs(cardId),
    enabled: !!cardId,
  });

  return (
    <div className="px-6 py-4 border-b space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">Pull Requests</h3>

      {isLoading && (
        <p className="text-xs text-gray-400">Loading PRs...</p>
      )}

      {error && (
        <p className="text-xs text-red-500">
          {error instanceof Error ? error.message : 'Failed to load PRs'}
        </p>
      )}

      {data && data.prs.length === 0 && (
        <p className="text-sm text-gray-400 py-2">No PRs linked to this card.</p>
      )}

      {data && data.prs.length > 0 && (
        <div className="space-y-2">
          {data.prs.map((pr) => (
            <PRItem key={pr.id} pr={pr} />
          ))}
        </div>
      )}
    </div>
  );
}
