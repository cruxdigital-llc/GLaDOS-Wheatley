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

const PHASE_ACCENT: Record<string, string> = {
  unclaimed: 'wh-phase-unclaimed',
  planning: 'wh-phase-planning',
  speccing: 'wh-phase-speccing',
  implementing: 'wh-phase-implementing',
  verifying: 'wh-phase-verifying',
  done: 'wh-phase-done',
};

const PHASE_BADGE_STYLE: Record<string, string> = {
  unclaimed: 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400',
  planning: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
  speccing: 'bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400',
  implementing: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
  verifying: 'bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400',
  done: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
};

const PRIORITY_STYLE: Record<string, string> = {
  P0: 'bg-red-500 text-white',
  P1: 'bg-orange-400 text-white',
  P2: 'bg-yellow-400 text-gray-900',
  P3: 'bg-stone-300 text-stone-600 dark:bg-stone-700 dark:text-stone-400',
};

interface CardProps {
  card: BoardCard;
  onClick?: (card: BoardCard) => void;
  currentUser?: string;
  branch?: string;
  coordinationBranch?: string;
  onConflict?: (claimedBy: string) => void;
  onDragStart?: (cardId: string, fromPhase: BoardPhase) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
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
  const phaseAccent = PHASE_ACCENT[card.phase] ?? 'wh-phase-unclaimed';
  const phaseBadge = PHASE_BADGE_STYLE[card.phase] ?? PHASE_BADGE_STYLE.unclaimed;

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
      className={`transition-all duration-200 ${isDragging ? 'opacity-30 scale-95' : 'opacity-100'}`}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => onClick?.(card)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(card); } }}
        className={`wh-card ${phaseAccent} w-full text-left p-3.5 cursor-pointer ${
          isFocused ? 'ring-2 ring-[var(--color-primary)] border-[var(--color-primary)]' : ''
        }`}
      >
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-heading text-[0.82rem] font-semibold leading-snug" style={{ color: 'var(--color-text)' }}>
            {card.title}
          </h3>
          {card.source === 'spec' && (
            <span className="shrink-0 font-mono text-[0.6rem] tracking-wider uppercase px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-500 dark:bg-indigo-950 dark:text-indigo-400">
              spec
            </span>
          )}
        </div>

        {/* Badges row */}
        <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
          <span className={`wh-badge ${phaseBadge}`}>
            {card.phase}
          </span>
          {card.metadata?.priority && (
            <span className={`wh-badge ${PRIORITY_STYLE[card.metadata.priority]}`}>
              {card.metadata.priority}
            </span>
          )}
          <span className="font-mono text-[0.6rem] tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
            {card.id}
          </span>
        </div>

        {/* Labels & due date */}
        {(card.metadata?.labels?.length || card.metadata?.due) && (
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            {card.metadata.labels?.slice(0, 2).map((label) => (
              <span
                key={label}
                className="text-[0.65rem] font-medium px-2 py-0.5 rounded-full border"
                style={{
                  background: 'var(--color-primary-subtle)',
                  color: 'var(--color-primary)',
                  borderColor: 'var(--color-border)',
                }}
              >
                {label}
              </span>
            ))}
            {card.metadata.due && (
              <span
                className={`text-[0.65rem] font-medium px-2 py-0.5 rounded ${
                  card.metadata.due < new Date().toISOString().slice(0, 10)
                    ? 'bg-red-50 text-red-500 dark:bg-red-950 dark:text-red-400'
                    : ''
                }`}
                style={
                  card.metadata.due >= new Date().toISOString().slice(0, 10)
                    ? { color: 'var(--color-text-muted)' }
                    : undefined
                }
              >
                {card.metadata.due}
              </span>
            )}
          </div>
        )}

        {/* Claimant */}
        {card.claim && (
          <div className="mt-2.5 flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 text-[0.7rem] font-medium px-2.5 py-0.5 rounded-full border ${
                isOwnClaim
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800'
                  : ''
              }`}
              style={
                !isOwnClaim
                  ? {
                      background: 'var(--color-surface-hover)',
                      color: 'var(--color-text-secondary)',
                      borderColor: 'var(--color-border)',
                    }
                  : undefined
              }
            >
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                isOwnClaim ? 'bg-emerald-400' : 'bg-stone-400 dark:bg-stone-600'
              }`} />
              {isOwnClaim ? 'You' : card.claim.claimant}
            </span>
            <span className="text-[0.6rem]" style={{ color: 'var(--color-text-muted)' }}>
              {formatClaimTime(card.claim.claimedAt)}
            </span>
            {coordinationBranch && branch && coordinationBranch !== branch && (
              <span
                className="text-[0.6rem] px-1.5 py-0.5 rounded"
                style={{ background: 'var(--column-bg)', color: 'var(--color-text-muted)' }}
              >
                coord branch
              </span>
            )}
          </div>
        )}

        {/* Stale claim warning */}
        {card.stale && (
          <div className="mt-1.5">
            <span className="text-[0.65rem] font-medium px-2 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">
              stale claim
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-2.5 flex gap-2">
          {canClaim && (
            <button
              type="button"
              onClick={handleClaim}
              disabled={claimMutation.isPending}
              className="wh-btn-primary text-[0.7rem] font-medium px-3 py-1 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'var(--color-primary)',
                color: 'white',
                border: 'none',
                transition: 'all 0.15s ease',
              }}
            >
              {claimMutation.isPending ? 'Claiming...' : 'Claim'}
            </button>
          )}
          {isOwnClaim && (
            <button
              type="button"
              onClick={handleRelease}
              disabled={releaseMutation.isPending}
              className="text-[0.7rem] font-medium px-3 py-1 rounded-md border disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-secondary)',
                background: 'transparent',
              }}
            >
              {releaseMutation.isPending ? 'Releasing...' : 'Release'}
            </button>
          )}
        </div>

        {/* Branch badges */}
        {card.branches && card.branches.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {card.branches.map((b) => (
              <span
                key={b}
                className="font-mono text-[0.6rem] px-1.5 py-0.5 rounded"
                style={{
                  background: 'var(--color-primary-subtle)',
                  color: 'var(--color-primary)',
                }}
              >
                {b}
              </span>
            ))}
          </div>
        )}

        {card.statusTask && (
          <div className="mt-1.5 text-[0.7rem] truncate" style={{ color: 'var(--color-text-muted)' }}>
            {card.statusTask.description}
          </div>
        )}

        {/* GLaDOS workflow badge */}
        {isWorkflowRunning && (
          <div className="mt-2.5">
            <span className="wh-glow-pulse inline-flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md bg-violet-50 text-violet-600 border border-violet-200 dark:bg-violet-950 dark:text-violet-400 dark:border-violet-800">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-500" />
              GLaDOS Active
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
