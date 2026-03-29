/**
 * Board Card Component
 *
 * Displays a single task card with title, phase badge, claim info,
 * and Claim/Release action buttons when a user identity is set.
 * Supports HTML5 drag-and-drop for phase transitions.
 */

import React from 'react';
import type { BoardCard, BoardPhase } from '../../shared/grammar/types.js';
import { useClaimItem, useReleaseItem } from '../hooks/use-claims.js';
import { useWorkflowStatus } from '../hooks/use-workflow-status.js';
import { ClaimConflictError } from '../api.js';

const PRIORITY_COLORS: Record<string, string> = {
  P0: 'bg-red-500 text-white',
  P1: 'bg-orange-400 text-white',
  P2: 'bg-yellow-400 text-gray-900',
  P3: 'bg-gray-300 text-gray-700',
};

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
  /** The coordination branch claims are read from. When it differs from `branch`,
   *  an indicator is shown on cards that have an active claim. */
  coordinationBranch?: string;
  onConflict?: (claimedBy: string) => void;
  /** Called when drag starts on this card. */
  onDragStart?: (cardId: string, fromPhase: BoardPhase) => void;
  /** Called when drag ends (dropped or cancelled). */
  onDragEnd?: () => void;
  /** True when this card is being dragged (shows reduced opacity). */
  isDragging?: boolean;
  /** True when this card has keyboard-navigation focus. */
  isFocused?: boolean;
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

export function Card({
  card,
  onClick,
  currentUser,
  branch,
  coordinationBranch,
  onConflict,
  onDragStart,
  onDragEnd,
  isDragging,
  isFocused,
}: CardProps) {
  const phaseColor = PHASE_COLORS[card.phase] ?? 'bg-gray-100 text-gray-700';

  const claimMutation = useClaimItem(branch);
  const releaseMutation = useReleaseItem(branch);
  const { data: workflowStatus } = useWorkflowStatus(card.id);

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

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('cardId', card.id);
    e.dataTransfer.setData('fromPhase', card.phase);
    e.dataTransfer.effectAllowed = 'move';
    onDragStart?.(card.id, card.phase);
  };

  const handleDragEnd = () => {
    onDragEnd?.();
  };

  const isWorkflowRunning = workflowStatus?.status === 'running';

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`transition-opacity ${isDragging ? 'opacity-40' : 'opacity-100'}`}
    >
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick?.(card)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(card); } }}
      className={`w-full text-left bg-white rounded-lg shadow-sm border p-3 hover:shadow-md transition-shadow cursor-pointer ${isFocused ? 'border-blue-500 ring-2 ring-blue-400' : 'border-gray-200'}`}
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
        {card.metadata?.priority && (
          <span className={`text-xs px-1.5 py-0.5 rounded font-semibold leading-none ${PRIORITY_COLORS[card.metadata.priority]}`}>
            {card.metadata.priority}
          </span>
        )}
        <span className="text-xs text-gray-400">{card.id}</span>
      </div>

      {/* Metadata: labels and due date */}
      {(card.metadata?.labels?.length || card.metadata?.due) && (
        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
          {card.metadata.labels?.slice(0, 2).map((label) => (
            <span
              key={label}
              className="text-xs px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200"
            >
              {label}
            </span>
          ))}
          {card.metadata.due && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded ${
                card.metadata.due < new Date().toISOString().slice(0, 10)
                  ? 'bg-red-50 text-red-600 border border-red-200'
                  : 'text-gray-500'
              }`}
            >
              {card.metadata.due}
            </span>
          )}
        </div>
      )}

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
          {/* Cross-branch indicator: shown when the claim comes from a different branch */}
          {coordinationBranch && branch && coordinationBranch !== branch && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 w-fit">
              coordination branch
            </span>
          )}
        </div>
      )}

      {/* Stale claim warning: claim exists but no spec or status activity on viewed branch */}
      {card.stale && (
        <div className="mt-1">
          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
            stale claim
          </span>
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

      {/* Branch badges — shown in consolidated view when card appears on multiple branches */}
      {card.branches && card.branches.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {card.branches.map((b) => (
            <span
              key={b}
              className="text-xs px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200"
            >
              {b}
            </span>
          ))}
        </div>
      )}

      {card.statusTask && (
        <div className="mt-1 text-xs text-gray-400 truncate">
          {card.statusTask.description}
        </div>
      )}

      {/* GLaDOS workflow status badge */}
      {isWorkflowRunning && (
        <div className="mt-2">
          <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 animate-pulse">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-500" />
            GLaDOS Running...
          </span>
        </div>
      )}
    </div>
    </div>
  );
}
