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
import { triggerSync, createCard, startWorkflow } from '../api.js';
import { CreateCardModal } from './CreateCardModal.js';
import { useExecuteTransition } from '../hooks/use-transitions.js';
import { Column } from './Column.js';
import { CardDetail } from './CardDetail.js';
import { BranchSelector } from './BranchSelector.js';
import { ConflictModal } from './ConflictModal.js';
import { ConfirmTransitionModal } from './ConfirmTransitionModal.js';
import { WorkflowLaunchPanel } from './WorkflowLaunchPanel.js';
import type { LaunchResult } from './WorkflowLaunchPanel.js';
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
import { FilterDrawer } from './FilterDrawer.js';
import { SettingsMenu } from './SettingsMenu.js';
import { useKeyboardShortcuts } from '../hooks/use-keyboard-shortcuts.js';
import type { ShortcutDef } from '../hooks/use-keyboard-shortcuts.js';
import { phaseDisplayName } from '../../shared/display-names.js';

const VIEW_LABELS: Record<string, string> = { board: 'Board', list: 'List', timeline: 'Timeline', calendar: 'Calendar' };

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
  const [conflictInfo, setConflictInfo] = useState<{ claimedBy: string } | null>(null);
  const [userNameWarning, setUserNameWarning] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [editingDisplayName, setEditingDisplayName] = useState(false);

  // Drag state
  const [dragState, setDragState] = useState<DragState | null>(null);
  // Pending transition awaiting confirmation
  const [pendingTransition, setPendingTransition] = useState<PendingTransition | null>(null);
  // Optimistic column override: board columns with card moved locally
  const [optimisticColumns, setOptimisticColumns] = useState<BoardColumn[] | null>(null);
  // Transition error and in-flight card ID
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [transitioningCardId, setTransitioningCardId] = useState<string | null>(null);
  // Workflow launch intent (from transition suggestion)
  const [workflowLaunchIntent, setWorkflowLaunchIntent] = useState<{
    type: string;
    cardId: string;
    cardTitle: string;
  } | null>(null);
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

  // Auto-dismiss transition errors after 8 seconds
  useEffect(() => {
    if (!transitionError) return;
    const timer = setTimeout(() => setTransitionError(null), 8000);
    return () => clearTimeout(timer);
  }, [transitionError]);

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
    (cardId: string, cardTitle: string, from: BoardPhase, to: BoardPhase, originalColumns: BoardColumn[], existingSpecDir?: string) => {
      // Apply optimistic update
      setOptimisticColumns(moveCardOptimistically(originalColumns, cardId, to));
      setTransitioningCardId(cardId);

      transitionMutation.mutate(
        { itemId: cardId, from, to, existingSpecDir },
        {
          onSuccess: (data) => {
            // Server state wins; clear optimistic override
            setOptimisticColumns(null);
            setTransitioningCardId(null);
            // If the transition suggests a workflow, show the launch panel
            if (data?.workflowSuggestion) {
              setWorkflowLaunchIntent({
                type: data.workflowSuggestion.type,
                cardId: data.workflowSuggestion.cardId,
                cardTitle,
              });
            }
          },
          onError: (err) => {
            // Roll back
            setOptimisticColumns(null);
            setTransitioningCardId(null);
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

      executeTransitionNow(cardId, card?.title ?? cardId, fromPhase, toPhase, sourceColumns, card?.specEntry?.dirName);
    },
    [activeBoard, optimisticColumns, executeTransitionNow],
  );

  const handleConfirmTransition = useCallback(() => {
    if (!pendingTransition) return;
    const { cardId, cardTitle, from, to } = pendingTransition;
    const sourceColumns = optimisticColumns ?? activeBoard?.columns ?? [];
    const card = sourceColumns.flatMap((c) => c.cards).find((c) => c.id === cardId);
    setPendingTransition(null);
    executeTransitionNow(cardId, cardTitle, from, to, sourceColumns, card?.specEntry?.dirName);
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

  const activeFilterCount = (filter.phases.length > 0 ? 1 : 0) + (filter.claimant ? 1 : 0) + (filter.priority ? 1 : 0) + (filter.hasLabels ? 1 : 0);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Header — Row 1: Primary bar */}
      <header className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 shadow-sm">
        <div className="max-w-full mx-auto px-4 py-3 flex items-center justify-between gap-3">
          {/* Left: Title + Repo */}
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Wheatley</h1>
            <RepoSelector
              currentRepo={currentRepo}
              onRepoChange={(repoId) => {
                setCurrentRepo(repoId);
                void queryClient.invalidateQueries({ queryKey: ['board'] });
              }}
            />
            <RepoStatusIndicator />
          </div>

          {/* Center: View switcher */}
          <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden text-sm">
            {(['board', 'list', 'timeline', 'calendar'] as BoardView[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setBoardView(v)}
                className={`px-3 py-1.5 ${v !== 'board' ? 'border-l border-gray-300 dark:border-gray-600' : ''} ${boardView === v ? 'bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              >
                {VIEW_LABELS[v] ?? v}
              </button>
            ))}
          </div>

          {/* Right: User name, search, notifications, settings */}
          <div className="flex items-center gap-3">
            <SearchBar branch={branch} onResultClick={(cardId) => setSelectedCardId(cardId)} inputRef={searchInputRef} />

            {activeBoard && (
              <div className="text-xs text-gray-500 dark:text-gray-400 hidden lg:block">
                {activeBoard.metadata.totalCards} cards &middot;{' '}
                {activeBoard.metadata.completedCount} done
              </div>
            )}

            {/* Display name (text, not input) */}
            {editingDisplayName ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={currentUser}
                  onChange={handleUserChange}
                  onBlur={() => setEditingDisplayName(false)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditingDisplayName(false); }}
                  autoFocus
                  placeholder="Your name..."
                  className={`text-sm border rounded px-2 py-1 w-32 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${userNameWarning ? 'border-yellow-400 focus:ring-yellow-400' : 'border-gray-300 dark:border-gray-600'}`}
                />
                {userNameWarning && (
                  <span className="text-xs text-yellow-600">{userNameWarning}</span>
                )}
              </div>
            ) : (
              <span
                className="text-sm text-gray-700 dark:text-gray-300 cursor-default"
                title={currentUser || 'No display name set'}
              >
                {currentUser || <span className="text-gray-400 italic">Anonymous</span>}
              </span>
            )}

            <NotificationBell onCardClick={(cardId) => setSelectedCardId(cardId)} />

            <SettingsMenu
              showActivityFeed={showActivityFeed}
              onToggleActivityFeed={() => setShowActivityFeed((v) => !v)}
              showHealthPanel={showHealthPanel}
              onToggleHealthPanel={() => setShowHealthPanel((v) => !v)}
              viewAllBranches={viewMode === 'consolidated'}
              onToggleViewAllBranches={() => setViewMode((v) => v === 'consolidated' ? 'single' : 'consolidated')}
              onEditDisplayName={() => setEditingDisplayName(true)}
            />
          </div>
        </div>

        {/* Row 2: Toolbar */}
        <div className="max-w-full mx-auto px-4 py-2 flex items-center justify-between gap-3 border-t border-gray-100 dark:border-gray-700">
          {/* Left: Filter toggle + Sort */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setFilterOpen((v) => !v)}
              className={`relative text-sm px-3 py-1 rounded-lg border transition-colors ${
                filterOpen || !isFilterEmpty(filter)
                  ? 'bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-600 font-medium'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              Filters
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="default">Sort: Default</option>
              <option value="priority">Sort: Priority</option>
              <option value="due">Sort: Due Date</option>
              <option value="newest">Sort: Newest First</option>
              <option value="activity">Sort: Last Activity</option>
            </select>
          </div>

          {/* Right: Branch selector + Sync */}
          <div className="flex items-center gap-3">
            {viewMode === 'single' && (
              <BranchSelector selectedBranch={branch} onBranchChange={setBranch} />
            )}

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
              className="text-sm px-3 py-1 rounded-lg border bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
              title="Sync with repository"
            >
              {syncing ? 'Syncing...' : 'Sync'}
            </button>
          </div>
        </div>
      </header>

      {/* Parse warnings banner */}
      {activeBoard?.warnings && activeBoard.warnings.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-4 py-2">
          <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
            <span>&#9888;</span>
            <span>
              {activeBoard.warnings.length} parsing warning{activeBoard.warnings.length > 1 ? 's' : ''}:
              {' '}{activeBoard.warnings.map((w) => w.message).join('; ')}
            </span>
          </div>
        </div>
      )}

      {/* Collapsible Filter Drawer */}
      <FilterDrawer
        isOpen={filterOpen}
        filter={filter}
        onFilterChange={setFilter}
        currentUser={currentUser}
        presets={presets}
        onPresetsChange={(next) => { setPresets(next); savePresets(next); }}
        onClear={() => setFilter(defaultFilter())}
        isFilterEmpty={isFilterEmpty(filter)}
      />

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
                  transitioningCardId={transitioningCardId ?? undefined}
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
      {selectedCardId && (
        <CardDetail detail={cardDetail ?? null} loading={!cardDetail} branch={branch} currentUser={currentUser} onClose={handleCloseDetail} />
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

      {/* Workflow Launch Panel (from transition suggestion) */}
      {workflowLaunchIntent && (
        <WorkflowLaunchPanel
          cardId={workflowLaunchIntent.cardId}
          cardTitle={workflowLaunchIntent.cardTitle}
          workflowType={workflowLaunchIntent.type}
          onLaunch={(result: LaunchResult) => {
            void startWorkflow(
              workflowLaunchIntent.cardId,
              workflowLaunchIntent.type,
              undefined,
              branch,
              workflowLaunchIntent.cardTitle,
              result.contextHints,
            );
            // Open the card detail to see the workflow panel
            setSelectedCardId(workflowLaunchIntent.cardId);
            setWorkflowLaunchIntent(null);
          }}
          onCancel={() => setWorkflowLaunchIntent(null)}
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
        selectedPhases={(() => {
          const map = new Map<string, BoardPhase>();
          for (const col of activeBoard?.columns ?? []) {
            for (const card of col.cards) {
              if (selectedCards.has(card.id)) {
                map.set(card.id, card.phase);
              }
            }
          }
          return map;
        })()}
        onDone={() => {
          setSelectedCards(new Set());
          void queryClient.invalidateQueries({ queryKey: ['board'] });
        }}
        onClearSelection={() => setSelectedCards(new Set())}
      />
    </div>
  );
}
