/**
 * Board Column Component
 *
 * Displays a phase column with its cards.
 * Supports HTML5 drag-and-drop as a drop target for phase transitions.
 */

import React, { useState } from 'react';
import type { BoardColumn as BoardColumnType, BoardCard, BoardPhase } from '../../shared/grammar/types.js';
import { Card } from './Card.js';
import { phaseDisplayName } from '../../shared/display-names.js';

const COLUMN_HEADER_COLORS: Record<string, string> = {
  unclaimed: 'border-t-gray-400',
  planning: 'border-t-blue-400',
  speccing: 'border-t-purple-400',
  implementing: 'border-t-yellow-400',
  verifying: 'border-t-orange-400',
  done: 'border-t-green-400',
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
  collapsed,
  onToggleCollapse,
}: ColumnProps) {
  const borderColor = COLUMN_HEADER_COLORS[column.phase] ?? 'border-t-gray-400';
  const [isDragOver, setIsDragOver] = useState(false);

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
    dropZoneClass = 'ring-2 ring-blue-400 bg-blue-50';
  } else if (isValidTarget) {
    dropZoneClass = 'ring-2 ring-blue-200';
  } else if (isInvalidTarget) {
    dropZoneClass = 'opacity-40';
  }

  if (collapsed) {
    return (
      <div
        className={`flex flex-col bg-gray-50 dark:bg-gray-800/50 rounded-lg border-t-4 ${borderColor} min-w-[48px] max-w-[48px] transition-all ${dropZoneClass}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center py-2 gap-1">
          <span className="text-[10px] text-gray-400 dark:text-gray-500 px-1 py-0.5">
            {column.cards.length}
          </span>
          <span
            className="text-xs font-semibold tracking-wider uppercase text-gray-500 dark:text-gray-400 whitespace-nowrap"
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
      className={`flex flex-col bg-gray-50 dark:bg-gray-800/50 rounded-lg border-t-4 ${borderColor} min-w-[280px] max-w-[320px] transition-all ${dropZoneClass}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="px-3 py-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-wider uppercase text-gray-500 dark:text-gray-400">{phaseDisplayName(column.phase)}</h2>
        <div className="flex items-center gap-1.5">
          {onAddCard && (
            <button
              type="button"
              onClick={() => onAddCard(column.phase)}
              className="text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded w-5 h-5 flex items-center justify-center text-sm leading-none"
              title="Add card"
            >
              +
            </button>
          )}
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            {column.cards.length}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
        {column.cards.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">
            {isDragOver ? 'Drop here' : 'No items'}
          </p>
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
