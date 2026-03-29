/**
 * Board Card Component
 *
 * Displays a single task card with title, phase badge, claim info,
 * and Claim/Release action buttons when a user identity is set.
 */

import React from 'react';
import type { BoardCard } from '../../shared/grammar/types.js';
import { useClaimItem, useReleaseItem } from '../hooks/use-claims.js';
import { ClaimConflictError } from '../api.js';

const PHASE_COLORS: Record<string, string> = {
  unclaimed: 'bg-gray-100 text-gray-700',
  planning: 'bg-blue-100 text-blue-700',
  speccing: 'bg-purple-100 text-purple-700',
  implementing: 'bg-yellow-100 text-yellow-700',
  verifying: 'bg-orange-100 text-orange-700',
  done: 'bg-green-100 text-green-700',
};

interface CardProps {
  card: BoardCard;
  onClick?: (card: BoardCard) => void;
  currentUser?: string;
  branch?: string;
  onConflict?: (claimedBy: string) => void;
}

function formatClaimTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function Card({ card, onClick, currentUser, branch, onConflict }: CardProps) {
  const phaseColor = PHASE_COLORS[card.phase] ?? 'bg-gray-100 text-gray-700';

  const claimMutation = useClaimItem(branch);
  const releaseMutation = useReleaseItem(branch);

  const isOwnClaim = !!currentUser && card.claim?.claimant === currentUser;
  const isUnclaimed = !card.claim;
  const canClaim = isUnclaimed && !!currentUser;

  const handleClaim = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) return;
    claimMutation.mutate(
      { itemId: card.id, claimant: currentUser },
      {
        onError: (err) => {
          if (err instanceof ClaimConflictError) {
            onConflict?.(err.claimedBy);
          } else {
            console.error('Claim failed:', err);
          }
        },
      },
    );
  };

  const handleRelease = (e: React.MouseEvent) => {
    e.stopPropagation();
    releaseMutation.mutate(
      { itemId: card.id, claimant: currentUser },
      {
        onError: (err) => {
          console.error('Release failed:', err);
        },
      },
    );
  };

  return (
    <button
      type="button"
      onClick={() => onClick?.(card)}
      className="w-full text-left bg-white rounded-lg shadow-sm border border-gray-200 p-3 hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-gray-900 leading-tight">
          {card.title}
        </h3>
        {card.source === 'spec' && (
          <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600">
            spec
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${phaseColor}`}>
          {card.phase}
        </span>
        <span className="text-xs text-gray-400">{card.id}</span>
      </div>

      {/* Claimant badge */}
      {card.claim && (
        <div className="mt-2 flex flex-col gap-0.5">
          <span
            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border w-fit font-medium ${
              isOwnClaim
                ? 'bg-green-50 text-green-700 border-green-200'
                : 'bg-gray-100 text-gray-600 border-gray-200'
            }`}
          >
            {isOwnClaim ? 'You' : card.claim.claimant}
          </span>
          <span className="text-xs text-gray-400">{formatClaimTime(card.claim.claimedAt)}</span>
        </div>
      )}

      {/* Claim / Release buttons */}
      <div className="mt-2 flex gap-2">
        {canClaim && (
          <button
            type="button"
            onClick={handleClaim}
            disabled={claimMutation.isPending}
            className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {claimMutation.isPending ? 'Claiming…' : 'Claim'}
          </button>
        )}
        {isOwnClaim && (
          <button
            type="button"
            onClick={handleRelease}
            disabled={releaseMutation.isPending}
            className="text-xs px-2 py-0.5 rounded bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {releaseMutation.isPending ? 'Releasing…' : 'Release'}
          </button>
        )}
      </div>

      {card.statusTask && (
        <div className="mt-1 text-xs text-gray-400 truncate">
          {card.statusTask.description}
        </div>
      )}
    </button>
  );
}
