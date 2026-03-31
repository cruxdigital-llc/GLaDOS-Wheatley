/**
 * Board Component
 *
 * Main Kanban board layout with columns for each GLaDOS phase.
 * Includes user identity input, filter controls, claim conflict handling,
 * and HTML5 drag-and-drop for phase transitions.
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { BoardCard, BoardColumn, BoardPhase } from '../../shared/grammar/types.js';
import { VALID_TRANSITIONS } from '../../shared/transitions/types.js';
import { useBoard, useCardDetail, useConsolidatedBoard, useBranchHealth, useGitIdentity } from '../hooks/use-board.js';
import { useSSE } from '../hooks/use-sse.js';
import { triggerSync, createCard } from '../api.js';
import { CreateCardModal } from './CreateCardModal.js';
import { useExecuteTransition } from '../hooks/use-transitions.js';
import { Column } from './Column.js';
import { CardDetail } from './CardDetail.js';
import { BranchSelector } from './BranchSelector.js';
import { ConflictModal } from './ConflictModal.js';
import { ConfirmTransitionModal } from './ConfirmTransitionModal.js';
import { BranchHealthPanel } from './BranchHealthPanel.js';
import { ActivityFeed } from './ActivityFeed.js';
import { RepoStatusIndicator } from './RepoStatusIndicator.js';
import { SearchBar } from './SearchBar.js';
import { ScrollIndicators } from './ScrollIndicators.js';
import { ShortcutOverlay } from './ShortcutOverlay.js';
import { NotificationBell } from './NotificationBell.js';
import { RepoSelector } from './RepoSelector.js';
import ListView from './ListView.js';
import TimelineView from './TimelineView.js';
import CalendarView from './CalendarView.js';
import { BulkActionBar } from './BulkActionBar.js';
import { DarkModeToggle } from './DarkModeToggle.js';
import { useKeyboardShortcuts } from '../hooks/use-keyboard-shortcuts.js';
import type { ShortcutDef } from '../hooks/use-keyboard-shortcuts.js';

type ViewMode = 'single' | 'consolidated';
type BoardView = 'board' | 'list' | 'timeline' | 'calendar';
type SortMode = 'default' | 'priority' | 'due' | 'newest' | 'activity';

interface CompoundFilter {
  phases: BoardPhase[];
  claimant: string;
  priority: string; // '' | 'P0' | 'P1' | 'P2' | 'P3'
  hasLabels: boolean;
}

interface SavedPreset {
  name: string;
  filter: CompoundFilter;
}

const PRIORITY_ORDER: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

function defaultFilter(): CompoundFilter {
  return { phases: [], claimant: '', priority: '', hasLabels: false };
}

function filterFromURL(): CompoundFilter {
  const params = new URLSearchParams(window.location.search);
  const f = defaultFilter();
  const phases = params.get('phases');
  if (phases) f.phases = phases.split(',').filter(Boolean) as BoardPhase[];
  const claimant = params.get('claimant');
  if (claimant) f.claimant = claimant;
  const priority = params.get('priority');
  if (priority) f.priority = priority;
  if (params.get('hasLabels') === '1') f.hasLabels = true;
  return f;
}

function filterToURL(f: CompoundFilter): void {
  const params = new URLSearchParams(window.location.search);
  // Clear old filter params
  params.delete('phases');
  params.delete('claimant');
  params.delete('priority');
  params.delete('hasLabels');
  if (f.phases.length) params.set('phases', f.phases.join(','));
  if (f.claimant) params.set('claimant', f.claimant);
  if (f.priority) params.set('priority', f.priority);
  if (f.hasLabels) params.set('hasLabels', '1');
  const qs = params.toString();
  const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  window.history.replaceState(null, '', url);
}

function loadPresets(): SavedPreset[] {
  try {
    const raw = localStorage.getItem('wheatley_saved_filters');
    if (raw) return JSON.parse(raw) as SavedPreset[];
  } catch { /* ignore */ }
  return [];
}

function savePresets(presets: SavedPreset[]): void {
  localStorage.setItem('wheatley_saved_filters', JSON.stringify(presets.slice(0, 10)));
}

function isFilterEmpty(f: CompoundFilter): boolean {
  return f.phases.length === 0 && !f.claimant && !f.priority && !f.hasLabels;
}

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
  const [currentRepo, setCurrentRepo] = useState<string>('default');
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [boardView, setBoardView] = useState<BoardView>('board');
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [showHealthPanel, setShowHealthPanel] = useState(false);
  const [showActivityFeed, setShowActivityFeed] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<string>(
    () => localStorage.getItem('wheatley_claimant') ?? '',
  );
  const [filter, setFilter] = useState<CompoundFilter>(filterFromURL);
  const [sortMode, setSortMode] = useState<SortMode>('default');
  const [presets, setPresets] = useState<SavedPreset[]>(loadPresets);
  const [presetName, setPresetName] = useState('');
  const [showPresetMenu, setShowPresetMenu] = useState(false);
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
  // Card creation
  const [createCardPhase, setCreateCardPhase] = useState<BoardPhase | null>(null);

  // Collapsed columns (persisted to localStorage)
  const [collapsedColumns, setCollapsedColumns] = useState<Set<BoardPhase>>(() => {
    try {
      const stored = localStorage.getItem('wheatley_collapsed_columns');
      if (stored) return new Set(JSON.parse(stored) as BoardPhase[]);
    } catch { /* ignore */ }
    return new Set();
  });

  // Keyboard navigation
  const [focusedCardIndex, setFocusedCardIndex] = useState<number>(-1);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { data: gitIdentity } = useGitIdentity();
  const [syncing, setSyncing] = useState(false);

  // Connect to SSE for real-time updates
  useSSE();

  // Persist filter state to URL
  useEffect(() => {
    filterToURL(filter);
  }, [filter]);

  // Auto-populate username from git config if user hasn't set one
  useEffect(() => {
    if (!currentUser && gitIdentity?.name) {
      setCurrentUser(gitIdentity.name);
      localStorage.setItem('wheatley_claimant', gitIdentity.name);
    }
  }, [gitIdentity, currentUser]);

  const { data: board, isLoading, error } = useBoard(viewMode === 'single' ? branch : undefined);
  const { data: consolidatedBoard, isLoading: consolidatedLoading } = useConsolidatedBoard(
    undefined,
    viewMode === 'consolidated',
  );
  const { data: healthData } = useBranchHealth(undefined, showHealthPanel);
  const { data: cardDetail } = useCardDetail(selectedCardId, branch);
  const transitionMutation = useExecuteTransition(branch);

  // Active board data depending on view mode
  const isConsolidated = viewMode === 'consolidated';
  const activeBoard = isConsolidated ? consolidatedBoard : board;
  const activeLoading = isConsolidated ? consolidatedLoading : isLoading;

  const handleCardClick = (card: BoardCard, event?: React.MouseEvent) => {
    // Multi-select with Shift+Click
    if (event?.shiftKey) {
      setSelectedCards((prev) => {
        const next = new Set(prev);
        if (next.has(card.id)) {
          next.delete(card.id);
        } else {
          next.add(card.id);
        }
        return next;
      });
      return;
    }
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

  const handleToggleCollapse = useCallback((phase: BoardPhase) => {
    setCollapsedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(phase)) {
        next.delete(phase);
      } else {
        next.add(phase);
      }
      localStorage.setItem('wheatley_collapsed_columns', JSON.stringify([...next]));
      return next;
    });
  }, []);

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

  /** Sort cards within a column based on sortMode. */
  const sortCards = useCallback((cards: BoardCard[]): BoardCard[] => {
    if (sortMode === 'default') return cards;
    const sorted = [...cards];
    sorted.sort((a, b) => {
      if (sortMode === 'priority') {
        const pa = a.metadata?.priority ? PRIORITY_ORDER[a.metadata.priority] ?? 99 : 99;
        const pb = b.metadata?.priority ? PRIORITY_ORDER[b.metadata.priority] ?? 99 : 99;
        return pa - pb;
      }
      if (sortMode === 'due') {
        const da = a.metadata?.due ?? '\uffff';
        const db = b.metadata?.due ?? '\uffff';
        return da.localeCompare(db);
      }
      if (sortMode === 'newest') {
        // Use claim time as proxy for "newest"
        const ta = a.claim?.claimedAt ?? '';
        const tb = b.claim?.claimedAt ?? '';
        return tb.localeCompare(ta);
      }
      if (sortMode === 'activity') {
        const ta = a.claim?.claimedAt ?? '';
        const tb = b.claim?.claimedAt ?? '';
        return tb.localeCompare(ta);
      }
      return 0;
    });
    return sorted;
  }, [sortMode]);

  const filteredColumns = useMemo<BoardColumn[]>(() => {
    if (!activeBoard && !optimisticColumns) return [];

    let cols = baseColumns;

    // Phase filter
    if (filter.phases.length > 0) {
      const phaseSet = new Set(filter.phases);
      cols = cols.filter((col) => phaseSet.has(col.phase));
    }

    // Card-level filters
    const needCardFilter = !!(filter.claimant || filter.priority || filter.hasLabels);
    if (needCardFilter) {
      cols = cols
        .map((col) => ({
          ...col,
          cards: col.cards.filter((card) => {
            if (filter.claimant && card.claim?.claimant !== filter.claimant) return false;
            if (filter.priority && card.metadata?.priority !== filter.priority) return false;
            if (filter.hasLabels && (!card.metadata?.labels || card.metadata.labels.length === 0)) return false;
            return true;
          }),
        }))
        .filter((col) => col.cards.length > 0 || filter.phases.length > 0);
    }

    // Sort cards within each column
    if (sortMode !== 'default') {
      cols = cols.map((col) => ({ ...col, cards: sortCards(col.cards) }));
    }

    return cols;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBoard, optimisticColumns, filter, currentUser, sortMode, sortCards]);

  // ---------------------------------------------------------------------------
  // Flat list of all visible cards (for keyboard navigation)
  // ---------------------------------------------------------------------------

  const allCards = useMemo(() => {
    return filteredColumns.flatMap((col) =>
      col.cards.map((card) => ({ card, columnPhase: col.phase })),
    );
  }, [filteredColumns]);

  /** The card ID that currently has keyboard focus. */
  const focusedCardId = focusedCardIndex >= 0 && focusedCardIndex < allCards.length
    ? allCards[focusedCardIndex].card.id
    : undefined;

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts
  // ---------------------------------------------------------------------------

  const shortcuts = useMemo<ShortcutDef[]>(() => [
    {
      key: '?',
      description: 'Toggle shortcut overlay',
      handler: () => setShowShortcuts((v) => !v),
    },
    {
      key: 'Escape',
      description: 'Close detail panel / overlay',
      handler: () => {
        if (showShortcuts) {
          setShowShortcuts(false);
        } else if (selectedCardId) {
          setSelectedCardId(null);
        } else {
          setFocusedCardIndex(-1);
        }
      },
    },
    {
      key: 'ArrowRight',
      description: 'Navigate to next column',
      handler: () => {
        if (filteredColumns.length === 0 || allCards.length === 0) return;
        const currentColPhase = focusedCardIndex >= 0 && focusedCardIndex < allCards.length
          ? allCards[focusedCardIndex].columnPhase
          : undefined;
        const colIdx = currentColPhase
          ? filteredColumns.findIndex((c) => c.phase === currentColPhase)
          : -1;
        const nextColIdx = Math.min(colIdx + 1, filteredColumns.length - 1);
        const nextCol = filteredColumns[nextColIdx];
        if (!nextCol || nextCol.cards.length === 0) return;
        const globalIdx = allCards.findIndex((c) => c.card.id === nextCol.cards[0].id);
        if (globalIdx >= 0) setFocusedCardIndex(globalIdx);
      },
    },
    {
      key: 'ArrowLeft',
      description: 'Navigate to previous column',
      handler: () => {
        if (filteredColumns.length === 0 || allCards.length === 0) return;
        const currentColPhase = focusedCardIndex >= 0 && focusedCardIndex < allCards.length
          ? allCards[focusedCardIndex].columnPhase
          : undefined;
        const colIdx = currentColPhase
          ? filteredColumns.findIndex((c) => c.phase === currentColPhase)
          : filteredColumns.length;
        const prevColIdx = Math.max(colIdx - 1, 0);
        const prevCol = filteredColumns[prevColIdx];
        if (!prevCol || prevCol.cards.length === 0) return;
        const globalIdx = allCards.findIndex((c) => c.card.id === prevCol.cards[0].id);
        if (globalIdx >= 0) setFocusedCardIndex(globalIdx);
      },
    },
    {
      key: 'ArrowDown',
      description: 'Navigate to next card',
      handler: () => {
        if (allCards.length === 0) return;
        setFocusedCardIndex((prev) => Math.min(prev + 1, allCards.length - 1));
      },
    },
    {
      key: 'ArrowUp',
      description: 'Navigate to previous card',
      handler: () => {
        if (allCards.length === 0) return;
        setFocusedCardIndex((prev) => Math.max(prev <= 0 ? 0 : prev - 1, 0));
      },
    },
    {
      key: 'Enter',
      description: 'Open selected card detail',
      handler: () => {
        if (focusedCardIndex >= 0 && focusedCardIndex < allCards.length) {
          setSelectedCardId(allCards[focusedCardIndex].card.id);
        }
      },
    },
    {
      key: 'c',
      description: 'Claim / release focused card',
      handler: () => {
        if (focusedCardIndex >= 0 && focusedCardIndex < allCards.length) {
          setSelectedCardId(allCards[focusedCardIndex].card.id);
        }
      },
    },
    {
      key: 'e',
      description: 'Edit focused card',
      handler: () => {
        if (focusedCardIndex >= 0 && focusedCardIndex < allCards.length) {
          setSelectedCardId(allCards[focusedCardIndex].card.id);
        }
      },
    },
    {
      key: '/',
      description: 'Focus search bar',
      ignoreInputs: true,
      handler: () => {
        searchInputRef.current?.focus();
      },
    },
  ], [showShortcuts, selectedCardId, filteredColumns, allCards, focusedCardIndex]);

  useKeyboardShortcuts(shortcuts);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 shadow-sm">
        <div className="max-w-full mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">Wheatley</h1>
            <RepoStatusIndicator />
            <SearchBar branch={branch} onResultClick={(cardId) => setSelectedCardId(cardId)} inputRef={searchInputRef} />
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
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={currentUser}
                  onChange={handleUserChange}
                  placeholder="Your name…"
                  className={`text-sm border rounded px-2 py-1 w-36 bg-white text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${userNameWarning ? 'border-yellow-400 focus:ring-yellow-400' : 'border-gray-300'}`}
                />
                {gitIdentity?.source === 'git-config' && currentUser === gitIdentity?.name && (
                  <span className="text-xs text-gray-400" title={`From git config${gitIdentity.email ? ` (${gitIdentity.email})` : ''}`}>git</span>
                )}
                {gitIdentity?.source === 'env' && (
                  <span className="text-xs text-gray-400" title="From WHEATLEY_COMMIT_AUTHOR">env</span>
                )}
              </div>
              {userNameWarning && (
                <span className="text-xs text-yellow-600 mt-0.5">{userNameWarning}</span>
              )}
            </div>

            {/* Quick filter presets */}
            <div className="flex items-center gap-1 text-sm">
              <button
                type="button"
                onClick={() => setFilter(defaultFilter())}
                className={`px-2 py-1 rounded border ${isFilterEmpty(filter) ? 'bg-blue-50 text-blue-700 border-blue-300 font-medium' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilter({ ...defaultFilter(), phases: ['unclaimed'] })}
                className={`px-2 py-1 rounded border ${filter.phases.length === 1 && filter.phases[0] === 'unclaimed' && !filter.claimant ? 'bg-blue-50 text-blue-700 border-blue-300 font-medium' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
              >
                Unclaimed
              </button>
              <button
                type="button"
                onClick={() => setFilter({ ...defaultFilter(), claimant: currentUser })}
                className={`px-2 py-1 rounded border ${filter.claimant === currentUser && currentUser ? 'bg-blue-50 text-blue-700 border-blue-300 font-medium' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
              >
                Mine
              </button>
            </div>

            {/* Sort control */}
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="text-sm border border-gray-300 rounded px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="default">Sort: Default</option>
              <option value="priority">Sort: Priority</option>
              <option value="due">Sort: Due Date</option>
              <option value="newest">Sort: Newest First</option>
              <option value="activity">Sort: Last Activity</option>
            </select>

            {/* View type switcher (Board / List / Timeline / Calendar) */}
            <div className="flex rounded border border-gray-300 dark:border-gray-600 overflow-hidden text-sm">
              {(['board', 'list', 'timeline', 'calendar'] as BoardView[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setBoardView(v)}
                  className={`px-2 py-1 capitalize ${v !== 'board' ? 'border-l border-gray-300 dark:border-gray-600' : ''} ${boardView === v ? 'bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                >
                  {v}
                </button>
              ))}
            </div>

            {/* Branch mode toggle */}
            <div className="flex rounded border border-gray-300 dark:border-gray-600 overflow-hidden text-sm">
              <button
                type="button"
                onClick={() => setViewMode('single')}
                className={`px-2 py-1 ${viewMode === 'single' ? 'bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              >
                Single
              </button>
              <button
                type="button"
                onClick={() => setViewMode('consolidated')}
                className={`px-2 py-1 border-l border-gray-300 dark:border-gray-600 ${viewMode === 'consolidated' ? 'bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              >
                All Branches
              </button>
            </div>

            {/* Dark mode toggle */}
            <DarkModeToggle />

            {/* Sync button */}
            <button
              type="button"
              disabled={syncing}
              onClick={async () => {
                setSyncing(true);
                try {
                  await triggerSync();
                  void queryClient.invalidateQueries({ queryKey: ['board'] });
                } catch {
                  // Silently fail — user can retry
                } finally {
                  setSyncing(false);
                }
              }}
              className="text-sm px-2 py-1 rounded border bg-white text-gray-600 border-gray-300 hover:bg-gray-50 disabled:opacity-50"
            >
              {syncing ? 'Syncing…' : 'Sync'}
            </button>

            {/* Notification bell */}
            <NotificationBell onCardClick={(cardId) => setSelectedCardId(cardId)} />

            {/* Repo selector */}
            <RepoSelector
              currentRepo={currentRepo}
              onRepoChange={(repoId) => {
                setCurrentRepo(repoId);
                void queryClient.invalidateQueries({ queryKey: ['board'] });
              }}
            />

            {/* Activity feed button */}
            <button
              type="button"
              onClick={() => setShowActivityFeed((v) => !v)}
              className={`text-sm px-2 py-1 rounded border ${showActivityFeed ? 'bg-purple-50 text-purple-700 border-purple-300' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
            >
              Activity
            </button>

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

      {/* Compound filter bar */}
      <div className="bg-white border-b px-4 py-2 flex items-center gap-3 flex-wrap text-sm">
        {/* Phase multi-select */}
        <label className="flex items-center gap-1 text-gray-600">
          Phase:
          <select
            multiple
            value={filter.phases}
            onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions, (o) => o.value as BoardPhase);
              setFilter((prev) => ({ ...prev, phases: selected }));
            }}
            className="border border-gray-300 rounded px-1 py-0.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400 h-16 text-xs"
          >
            {(['unclaimed', 'planning', 'speccing', 'implementing', 'verifying', 'done'] as BoardPhase[]).map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>

        {/* Claimant */}
        <label className="flex items-center gap-1 text-gray-600">
          Claimant:
          <input
            type="text"
            value={filter.claimant}
            onChange={(e) => setFilter((prev) => ({ ...prev, claimant: e.target.value }))}
            placeholder="name..."
            className="border border-gray-300 rounded px-2 py-0.5 w-28 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </label>

        {/* Priority */}
        <label className="flex items-center gap-1 text-gray-600">
          Priority:
          <select
            value={filter.priority}
            onChange={(e) => setFilter((prev) => ({ ...prev, priority: e.target.value }))}
            className="border border-gray-300 rounded px-1 py-0.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="">Any</option>
            <option value="P0">P0</option>
            <option value="P1">P1</option>
            <option value="P2">P2</option>
            <option value="P3">P3</option>
          </select>
        </label>

        {/* Has labels */}
        <label className="flex items-center gap-1 text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={filter.hasLabels}
            onChange={(e) => setFilter((prev) => ({ ...prev, hasLabels: e.target.checked }))}
          />
          Has labels
        </label>

        {/* Clear filters */}
        {!isFilterEmpty(filter) && (
          <button
            type="button"
            onClick={() => setFilter(defaultFilter())}
            className="text-xs text-red-500 hover:text-red-700 underline"
          >
            Clear filters
          </button>
        )}

        <div className="border-l border-gray-200 h-6 mx-1" />

        {/* Saved presets */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowPresetMenu((v) => !v)}
            className="px-2 py-0.5 rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
          >
            Presets
          </button>
          {showPresetMenu && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-30 py-1">
              {/* Save current */}
              <form
                className="px-3 py-2 border-b flex gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  const trimmed = presetName.trim();
                  if (!trimmed) return;
                  const next = [...presets.filter((p) => p.name !== trimmed), { name: trimmed, filter: { ...filter } }].slice(-10);
                  setPresets(next);
                  savePresets(next);
                  setPresetName('');
                }}
              >
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="Preset name..."
                  className="flex-1 text-xs border border-gray-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <button
                  type="submit"
                  className="text-xs px-2 py-0.5 rounded bg-blue-600 text-white hover:bg-blue-700"
                >
                  Save
                </button>
              </form>
              {presets.length === 0 && (
                <div className="px-3 py-2 text-xs text-gray-400">No saved presets</div>
              )}
              {presets.map((p) => (
                <div key={p.name} className="flex items-center justify-between px-3 py-1.5 hover:bg-gray-50 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFilter({ ...p.filter });
                      setShowPresetMenu(false);
                    }}
                    className="text-xs text-gray-700 flex-1 text-left truncate"
                  >
                    {p.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = presets.filter((x) => x.name !== p.name);
                      setPresets(next);
                      savePresets(next);
                    }}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Board */}
      <main className="p-4">
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

        {(activeBoard || optimisticColumns) && boardView === 'board' && (
          <ScrollIndicators>
            <div className="flex gap-4 min-h-[calc(100vh-120px)]">
              {filteredColumns.map((column) => (
                <Column
                  key={column.phase}
                  column={column}
                  onCardClick={handleCardClick}
                  currentUser={currentUser}
                  branch={branch}
                  onConflict={handleConflict}
                  validDropTargets={isConsolidated ? new Set() : validDropTargets}
                  draggingCardId={isConsolidated ? undefined : dragState?.cardId}
                  onDrop={isConsolidated ? undefined : handleColumnDrop}
                  onCardDragStart={isConsolidated ? undefined : handleDragStart}
                  onCardDragEnd={isConsolidated ? undefined : handleDragEnd}
                  onAddCard={isConsolidated ? undefined : (phase) => setCreateCardPhase(phase)}
                  collapsed={collapsedColumns.has(column.phase)}
                  onToggleCollapse={() => handleToggleCollapse(column.phase)}
                  focusedCardId={focusedCardId}
                />
              ))}
            </div>
          </ScrollIndicators>
        )}

        {(activeBoard || optimisticColumns) && boardView === 'list' && (
          <ListView
            columns={filteredColumns}
            onCardClick={handleCardClick}
            currentUser={currentUser}
          />
        )}

        {(activeBoard || optimisticColumns) && boardView === 'timeline' && (
          <TimelineView
            columns={filteredColumns}
            onCardClick={handleCardClick}
          />
        )}

        {(activeBoard || optimisticColumns) && boardView === 'calendar' && (
          <CalendarView
            columns={filteredColumns}
            onCardClick={handleCardClick}
          />
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
        <CardDetail detail={cardDetail} branch={branch} currentUser={currentUser} onClose={handleCloseDetail} />
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

      {/* Activity Feed Panel */}
      {showActivityFeed && (
        <ActivityFeed onClose={() => setShowActivityFeed(false)} />
      )}

      {/* Keyboard Shortcuts Overlay */}
      {showShortcuts && (
        <ShortcutOverlay
          shortcuts={shortcuts.map((s) => ({ key: s.key, description: s.description }))}
          onClose={() => setShowShortcuts(false)}
        />
      )}

      {/* Create Card Modal */}
      {createCardPhase && (
        <CreateCardModal
          targetPhase={createCardPhase}
          onCancel={() => setCreateCardPhase(null)}
          onConfirm={async (title) => {
            try {
              await createCard({ title, phase: createCardPhase, branch });
              setCreateCardPhase(null);
              void queryClient.invalidateQueries({ queryKey: ['board'] });
            } catch (err) {
              setTransitionError(err instanceof Error ? err.message : 'Failed to create card');
              setCreateCardPhase(null);
            }
          }}
        />
      )}

      {/* Bulk Action Bar (multi-select mode) */}
      <BulkActionBar
        selectedIds={selectedCards}
        currentUser={currentUser}
        branch={branch}
        onDone={() => {
          setSelectedCards(new Set());
          void queryClient.invalidateQueries({ queryKey: ['board'] });
        }}
        onClearSelection={() => setSelectedCards(new Set())}
      />
    </div>
  );
}
