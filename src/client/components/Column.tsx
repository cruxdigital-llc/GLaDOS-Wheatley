/**
 * Board Column Component
 *
 * Displays a phase column with its cards.
 * Supports HTML5 drag-and-drop as a drop target for phase transitions.
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { BoardColumn as BoardColumnType, BoardCard, BoardPhase } from '../../shared/grammar/types.js';
import { Card } from './Card.js';
import { phaseDisplayName } from '../../shared/display-names.js';

interface CardGroup {
  key: string;
  label: string;
  cards: BoardCard[];
}

/** Group cards by their roadmap phase > section for collapsible display. */
function groupCardsBySection(cards: BoardCard[]): CardGroup[] {
  const groups = new Map<string, CardGroup>();

  for (const card of cards) {
    const sectionTitle = card.roadmapItem?.sectionTitle;
    const phaseTitle = card.roadmapItem?.phaseTitle;

    if (sectionTitle && phaseTitle) {
      const key = `${phaseTitle}::${sectionTitle}`;
      if (!groups.has(key)) {
        groups.set(key, { key, label: sectionTitle, cards: [] });
      }
      groups.get(key)!.cards.push(card);
    } else {
      // No section info — put in "Other" group
      const key = '__other__';
      if (!groups.has(key)) {
        groups.set(key, { key, label: 'Other', cards: [] });
      }
      groups.get(key)!.cards.push(card);
    }
  }

  return Array.from(groups.values());
}

/** Load collapsed group state from localStorage. */
function loadCollapsedGroups(): Set<string> {
  try {
    const stored = localStorage.getItem('wheatley_collapsed_groups');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

/** Save collapsed group state to localStorage. */
function saveCollapsedGroups(collapsed: Set<string>): void {
  try {
    localStorage.setItem('wheatley_collapsed_groups', JSON.stringify([...collapsed]));
  } catch {
    // localStorage unavailable
  }
}

const COLUMN_HEADER_COLORS: Record<string, string> = {
  unclaimed: 'border-t-gray-400',
  planning: 'border-t-blue-400',
  speccing: 'border-t-purple-400',
  implementing: 'border-t-yellow-400',
  verifying: 'border-t-orange-400',
  done: 'border-t-green-400',
};

const COLUMN_HEADER_TEXT: Record<string, string> = {
  unclaimed: 'text-stone-500',
  planning: 'text-blue-500',
  speccing: 'text-purple-500',
  implementing: 'text-amber-500',
  verifying: 'text-orange-500',
  done: 'text-emerald-500',
};

const COLUMN_TOOLTIPS: Record<string, string> = {
  unclaimed: 'Items not yet started — available to claim and begin planning',
  planning: 'Plan and requirements being written — next: write the spec',
  speccing: 'Technical spec in progress — next: implement',
  implementing: 'Code being written — next: verify all tasks are complete',
  verifying: 'All tasks done, awaiting verification — next: mark as done',
  done: 'Completed and verified',
};

interface ColumnProps {
  column: BoardColumnType;
  onCardClick?: (card: BoardCard) => void;
  currentUser?: string;
  branch?: string;
  onConflict?: (claimedBy: string) => void;
  /** Set of phases that are valid drop targets for the card currently being dragged. */
  validDropTargets?: Set<BoardPhase>;
  /** The card ID currently being dragged (used for visual feedback). */
  draggingCardId?: string;
  /** Called when a card is dropped onto this column. */
  onDrop?: (cardId: string, fromPhase: BoardPhase, toPhase: BoardPhase) => void;
  /** Forwarded to Card — called when a drag starts. */
  onCardDragStart?: (cardId: string, fromPhase: BoardPhase) => void;
  /** Forwarded to Card — called when a drag ends. */
  onCardDragEnd?: () => void;
  /** Called when the user clicks the "+" button to add a card. */
  onAddCard?: (phase: BoardPhase) => void;
  /** Card ID that should show a keyboard-navigation focus ring. */
  focusedCardId?: string;
  /** Card ID currently mid-transition (optimistic move, server pending). */
  transitioningCardId?: string;
  /** Whether this column is collapsed. */
  collapsed?: boolean;
  /** Called when the collapse/expand toggle is clicked. */
  onToggleCollapse?: () => void;
}

export function Column({
  column,
  onCardClick,
  currentUser,
  branch,
  onConflict,
  validDropTargets,
  draggingCardId,
  onDrop,
  onCardDragStart,
  onCardDragEnd,
  onAddCard,
  focusedCardId,
  transitioningCardId,
  collapsed,
  onToggleCollapse,
}: ColumnProps) {
  const borderColor = COLUMN_HEADER_COLORS[column.phase] ?? 'border-t-gray-400';
  const headerTextColor = COLUMN_HEADER_TEXT[column.phase] ?? 'text-gray-500';
  const [isDragOver, setIsDragOver] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(loadCollapsedGroups);

  const toggleGroup = useCallback((groupKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      saveCollapsedGroups(next);
      return next;
    });
  }, []);

  // Group cards by section for the unclaimed column (or if many cards)
  const shouldGroup = column.phase === 'unclaimed' && column.cards.length > 5;
  const groups = useMemo(
    () => shouldGroup ? groupCardsBySection(column.cards) : [],
    [shouldGroup, column.cards],
  );

  const isDragging = !!draggingCardId;
  const isValidTarget = isDragging && validDropTargets?.has(column.phase);
  const isInvalidTarget = isDragging && !validDropTargets?.has(column.phase);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!isValidTarget) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    // Only clear if we're leaving the column container (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!isValidTarget) return;
    const cardId = e.dataTransfer.getData('cardId');
    const fromPhase = e.dataTransfer.getData('fromPhase') as BoardPhase;
    if (cardId && fromPhase) {
      onDrop?.(cardId, fromPhase, column.phase);
    }
  };

  let dropZoneClass = '';
  if (isDragOver && isValidTarget) {
    dropZoneClass = 'wh-drag-over';
  } else if (isValidTarget) {
    dropZoneClass = 'wh-drag-target';
  } else if (isInvalidTarget) {
    dropZoneClass = 'wh-drag-invalid';
  }

  if (collapsed) {
    return (
      <div
        className={`flex flex-col wh-column-collapsed border-t-4 ${borderColor} transition-all ${dropZoneClass}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center py-2 gap-1">
          <span className="text-[10px] px-1 py-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {column.cards.length}
          </span>
          <span
            className={`text-xs font-semibold tracking-wider uppercase ${headerTextColor} whitespace-nowrap`}
            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
          >
            {phaseDisplayName(column.phase)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col wh-column border-t-4 ${borderColor} transition-all ${dropZoneClass}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="px-3 py-2 flex items-center justify-between">
        <h2
          className={`text-xs font-semibold tracking-wider uppercase ${headerTextColor} cursor-help`}
          title={COLUMN_TOOLTIPS[column.phase] ?? ''}
        >
          {phaseDisplayName(column.phase)}
        </h2>
        <div className="flex items-center gap-1.5">
          {onAddCard && (
            <button
              type="button"
              onClick={() => onAddCard(column.phase)}
              className="rounded w-5 h-5 flex items-center justify-center text-sm leading-none transition-colors"
              style={{ color: 'var(--color-text-muted)' }}
              title="Add card"
            >
              +
            </button>
          )}
          <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
            {column.cards.length}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2 wh-stagger space-y-2">
        {column.cards.length === 0 ? (
          <p className="text-xs text-center py-4" style={{ color: 'var(--color-text-muted)' }}>
            {isDragOver ? 'Drop here' : 'No items'}
          </p>
        ) : shouldGroup ? (
          /* Grouped view for unclaimed columns with many cards */
          groups.map((group) => {
            const isGroupCollapsed = collapsedGroups.has(group.key);
            return (
              <div key={group.key} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <span className="truncate">{group.label}</span>
                  <span className="flex items-center gap-1 shrink-0 ml-2">
                    <span className="text-gray-400">{group.cards.length}</span>
                    <span className="text-gray-400">{isGroupCollapsed ? '▸' : '▾'}</span>
                  </span>
                </button>
                {!isGroupCollapsed && (
                  <div className="p-1.5 space-y-1.5">
                    {group.cards.map((card) => (
                      <Card
                        key={card.id}
                        card={card}
                        onClick={onCardClick}
                        currentUser={currentUser}
                        branch={branch}
                        onConflict={onConflict}
                        isDragging={card.id === draggingCardId}
                        onDragStart={onCardDragStart}
                        onDragEnd={onCardDragEnd}
                        isFocused={card.id === focusedCardId}
                        isTransitioning={card.id === transitioningCardId}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          column.cards.map((card) => (
            <Card
              key={card.id}
              card={card}
              onClick={onCardClick}
              currentUser={currentUser}
              branch={branch}
              onConflict={onConflict}
              isDragging={card.id === draggingCardId}
              onDragStart={onCardDragStart}
              onDragEnd={onCardDragEnd}
              isFocused={card.id === focusedCardId}
              isTransitioning={card.id === transitioningCardId}
            />
          ))
        )}
        {isDragOver && column.cards.length > 0 && (
          <div className="h-1 rounded bg-blue-300 mx-1" />
        )}
      </div>
    </div>
  );
}
