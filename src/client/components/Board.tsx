/**
 * Board Component
 *
 * Main Kanban board layout with columns for each GLaDOS phase.
 * Includes user identity input, filter controls, claim conflict handling,
 * and HTML5 drag-and-drop for phase transitions.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { BoardCard, BoardColumn, BoardPhase } from '../../shared/grammar/types.js';
import { VALID_TRANSITIONS } from '../../shared/transitions/types.js';
import { useBoard, useCardDetail, useConsolidatedBoard, useBranchHealth } from '../hooks/use-board.js';
import { useExecuteTransition } from '../hooks/use-transitions.js';
import { Column } from './Column.js';
import { CardDetail } from './CardDetail.js';
import { BranchSelector } from './BranchSelector.js';
import { ConflictModal } from './ConflictModal.js';
import { ConfirmTransitionModal } from './ConfirmTransitionModal.js';
import { BranchHealthPanel } from './BranchHealthPanel.js';

type FilterMode = 'all' | 'unclaimed' | 'mine';
type ViewMode = 'single' | 'consolidated';

/** Transitions that create files and require a confirmation dialog. */
const FILE_CREATING_TRANSITIONS = new Set([
  'unclaimed→planning',
  'planning→speccing',
  'speccing→implementing',
  'unclaimed→implementing',
]);

interface DragState {
  cardId: string;
  fromPhase: BoardPhase;
}

interface PendingTransition {
  cardId: string;
  cardTitle: string;
  from: BoardPhase;
  to: BoardPhase;
}

export function Board() {
  const queryClient = useQueryClient();

  const [branch, setBranch] = useState<string | undefined>();
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [showHealthPanel, setShowHealthPanel] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<string>(
    () => localStorage.getItem('wheatley_claimant') ?? '',
  );
  const [filter, setFilter] = useState<FilterMode>('all');
  const [conflictInfo, setConflictInfo] = useState<{ claimedBy: string } | null>(null);
  const [userNameWarning, setUserNameWarning] = useState<string | null>(null);

  // Drag state
  const [dragState, setDragState] = useState<DragState | null>(null);
  // Pending transition awaiting confirmation
  const [pendingTransition, setPendingTransition] = useState<PendingTransition | null>(null);
  // Optimistic column override: board columns with card moved locally
  const [optimisticColumns, setOptimisticColumns] = useState<BoardColumn[] | null>(null);
  // Transition error
  const [transitionError, setTransitionError] = useState<string | null>(null);

  const { data: board, isLoading, error } = useBoard(viewMode === 'single' ? branch : undefined);
  const { data: consolidatedBoard, isLoading: consolidatedLoading } = useConsolidatedBoard(
    undefined,
    viewMode === 'consolidated',
  );
  const { data: healthData } = useBranchHealth(undefined, showHealthPanel);
  const { data: cardDetail } = useCardDetail(selectedCardId, branch);
  const transitionMutation = useExecuteTransition(branch);

  // Active board data depending on view mode
  const activeBoard = viewMode === 'consolidated' ? consolidatedBoard : board;
  const activeLoading = viewMode === 'consolidated' ? consolidatedLoading : isLoading;

  const handleCardClick = (card: BoardCard) => {
    setSelectedCardId(card.id);
  };

  const handleCloseDetail = () => {
    setSelectedCardId(null);
  };

  const validateUserName = (name: string): string | null => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    if (trimmed.length > 100) return 'Name must be 100 characters or fewer';
    if (trimmed.includes('|')) return 'Name must not contain a pipe character (|)';
    for (let i = 0; i < trimmed.length; i++) {
      if (trimmed.charCodeAt(i) < 32) return 'Name must not contain newlines or control characters';
    }
    return null;
  };

  const handleUserChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setCurrentUser(name);
    const warning = validateUserName(name);
    setUserNameWarning(warning);
    if (!warning) {
      localStorage.setItem('wheatley_claimant', name);
    }
  };

  const handleConflict = (claimedBy: string) => {
    setConflictInfo({ claimedBy });
  };

  const handleConflictRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['board', branch] });
    setConflictInfo(null);
  };

  const handleConflictClose = () => {
    setConflictInfo(null);
  };

  // ---------------------------------------------------------------------------
  // Drag-and-drop handlers
  // ---------------------------------------------------------------------------

  const handleDragStart = useCallback((cardId: string, fromPhase: BoardPhase) => {
    setDragState({ cardId, fromPhase });
    setTransitionError(null);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragState(null);
  }, []);

  /** Move a card from one column to another in the given column list. */
  const moveCardOptimistically = useCallback(
    (columns: BoardColumn[], cardId: string, toPhase: BoardPhase): BoardColumn[] => {
      let movedCard: BoardCard | undefined;
      const updated = columns.map((col) => ({
        ...col,
        cards: col.cards.filter((c) => {
          if (c.id === cardId) {
            movedCard = { ...c, phase: toPhase };
            return false;
          }
          return true;
        }),
      }));
      if (!movedCard) return columns;
      return updated.map((col) =>
        col.phase === toPhase ? { ...col, cards: [...col.cards, movedCard!] } : col,
      );
    },
    [],
  );

  const executeTransitionNow = useCallback(
    (cardId: string, from: BoardPhase, to: BoardPhase, originalColumns: BoardColumn[]) => {
      // Apply optimistic update
      setOptimisticColumns(moveCardOptimistically(originalColumns, cardId, to));

      transitionMutation.mutate(
        { itemId: cardId, from, to },
        {
          onSuccess: () => {
            // Server state wins; clear optimistic override
            setOptimisticColumns(null);
          },
          onError: (err) => {
            // Roll back
            setOptimisticColumns(null);
            setTransitionError((err as Error).message ?? 'Transition failed');
          },
        },
      );
    },
    [transitionMutation, moveCardOptimistically],
  );

  const handleColumnDrop = useCallback(
    (cardId: string, fromPhase: BoardPhase, toPhase: BoardPhase) => {
      setDragState(null);
      const sourceColumns = optimisticColumns ?? activeBoard?.columns ?? [];
      const card = sourceColumns.flatMap((c) => c.cards).find((c) => c.id === cardId);
      const transitionKey = `${fromPhase}→${toPhase}`;

      if (FILE_CREATING_TRANSITIONS.has(transitionKey)) {
        setPendingTransition({
          cardId,
          cardTitle: card?.title ?? cardId,
          from: fromPhase,
          to: toPhase,
        });
        return;
      }

      executeTransitionNow(cardId, fromPhase, toPhase, sourceColumns);
    },
    [activeBoard, optimisticColumns, executeTransitionNow],
  );

  const handleConfirmTransition = useCallback(() => {
    if (!pendingTransition) return;
    const { cardId, from, to } = pendingTransition;
    const sourceColumns = optimisticColumns ?? activeBoard?.columns ?? [];
    setPendingTransition(null);
    executeTransitionNow(cardId, from, to, sourceColumns);
  }, [pendingTransition, activeBoard, optimisticColumns, executeTransitionNow]);

  const handleCancelTransition = useCallback(() => {
    setPendingTransition(null);
  }, []);

  /** Valid drop target phases for the card currently being dragged. */
  const validDropTargets = useMemo<Set<BoardPhase>>(() => {
    if (!dragState) return new Set();
    return new Set(VALID_TRANSITIONS.get(dragState.fromPhase) ?? []);
  }, [dragState]);

  // ---------------------------------------------------------------------------
  // Filtered columns
  // ---------------------------------------------------------------------------

  /** Base columns: server data overridden by optimistic local state. */
  const baseColumns = optimisticColumns ?? activeBoard?.columns ?? [];

  const filteredColumns = useMemo<BoardColumn[]>(() => {
    if (!activeBoard && !optimisticColumns) return [];

    if (filter === 'unclaimed') {
      return baseColumns.filter((col) => col.phase === 'unclaimed');
    }

    if (filter === 'mine') {
      return baseColumns
        .map((col) => ({
          ...col,
          cards: col.cards.filter(
            (card) => card.claim?.claimant === currentUser,
          ),
        }))
        .filter((col) => col.cards.length > 0);
    }

    return baseColumns;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBoard, optimisticColumns, filter, currentUser]);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-full mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">Wheatley</h1>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            {activeBoard && (
              <div className="text-xs text-gray-500">
                {activeBoard.metadata.totalCards} cards &middot;{' '}
                {activeBoard.metadata.completedCount} done &middot;{' '}
                {activeBoard.metadata.claimedCount} claimed
                {'branchCount' in activeBoard.metadata && (
                  <> &middot; {activeBoard.metadata.branchCount} branches</>
                )}
              </div>
            )}

            {/* User identity input */}
            <div className="flex flex-col items-start">
              <input
                type="text"
                value={currentUser}
                onChange={handleUserChange}
                placeholder="Your name…"
                className={`text-sm border rounded px-2 py-1 w-36 bg-white text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${userNameWarning ? 'border-yellow-400 focus:ring-yellow-400' : 'border-gray-300'}`}
              />
              {userNameWarning && (
                <span className="text-xs text-yellow-600 mt-0.5">{userNameWarning}</span>
              )}
            </div>

            {/* Filter dropdown */}
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterMode)}
              className="text-sm border border-gray-300 rounded px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="unclaimed">Unclaimed Only</option>
              <option value="mine">My Claims</option>
            </select>

            {/* View mode toggle */}
            <div className="flex rounded border border-gray-300 overflow-hidden text-sm">
              <button
                type="button"
                onClick={() => setViewMode('single')}
                className={`px-2 py-1 ${viewMode === 'single' ? 'bg-blue-50 text-blue-700 font-medium' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                Single
              </button>
              <button
                type="button"
                onClick={() => setViewMode('consolidated')}
                className={`px-2 py-1 border-l border-gray-300 ${viewMode === 'consolidated' ? 'bg-blue-50 text-blue-700 font-medium' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                All Branches
              </button>
            </div>

            {/* Branch health button */}
            <button
              type="button"
              onClick={() => setShowHealthPanel((v) => !v)}
              className={`text-sm px-2 py-1 rounded border ${showHealthPanel ? 'bg-teal-50 text-teal-700 border-teal-300' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
            >
              Health
            </button>

            {viewMode === 'single' && (
              <BranchSelector selectedBranch={branch} onBranchChange={setBranch} />
            )}
          </div>
        </div>
      </header>

      {/* Board */}
      <main className="p-4 overflow-x-auto">
        {activeLoading && (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-400 text-lg">Loading board…</div>
          </div>
        )}

        {error && viewMode === 'single' && (
          <div className="flex items-center justify-center h-64">
            <div className="text-red-500 text-center">
              <p className="text-lg font-medium">Failed to load board</p>
              <p className="text-sm mt-1">{(error as Error).message}</p>
            </div>
          </div>
        )}

        {/* Transition error toast */}
        {transitionError && (
          <div className="mb-3 flex items-center justify-between gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <span>{transitionError}</span>
            <button
              type="button"
              onClick={() => setTransitionError(null)}
              className="text-red-400 hover:text-red-600"
            >
              ✕
            </button>
          </div>
        )}

        {(activeBoard || optimisticColumns) && (
          <div className="flex gap-4 min-h-[calc(100vh-120px)]">
            {filteredColumns.map((column) => (
              <Column
                key={column.phase}
                column={column}
                onCardClick={handleCardClick}
                currentUser={currentUser}
                branch={branch}
                onConflict={handleConflict}
                validDropTargets={validDropTargets}
                draggingCardId={dragState?.cardId}
                onDrop={handleColumnDrop}
                onCardDragStart={handleDragStart}
                onCardDragEnd={handleDragEnd}
              />
            ))}
          </div>
        )}

        {activeBoard && activeBoard.metadata.totalCards === 0 && (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-400 text-center">
              <p className="text-lg font-medium">No tasks found</p>
              <p className="text-sm mt-1">
                This repository may not have a conforming ROADMAP.md or specs/ directory.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Card Detail Panel */}
      {selectedCardId && cardDetail && (
        <CardDetail detail={cardDetail} onClose={handleCloseDetail} />
      )}

      {/* Claim Conflict Modal */}
      {conflictInfo && (
        <ConflictModal
          claimedBy={conflictInfo.claimedBy}
          onRefresh={handleConflictRefresh}
          onClose={handleConflictClose}
        />
      )}

      {/* Confirm Transition Modal */}
      {pendingTransition && (
        <ConfirmTransitionModal
          cardId={pendingTransition.cardId}
          cardTitle={pendingTransition.cardTitle}
          from={pendingTransition.from}
          to={pendingTransition.to}
          onConfirm={handleConfirmTransition}
          onCancel={handleCancelTransition}
        />
      )}

      {/* Branch Health Panel */}
      {showHealthPanel && (
        <BranchHealthPanel
          health={healthData?.health ?? []}
          onClose={() => setShowHealthPanel(false)}
        />
      )}
    </div>
  );
}
