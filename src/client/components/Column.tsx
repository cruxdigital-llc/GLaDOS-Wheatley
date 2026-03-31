/**
 * Board Column Component
 *
 * Displays a phase column with its cards.
 * Supports HTML5 drag-and-drop as a drop target for phase transitions.
 */

import React, { useState } from 'react';
import type { BoardColumn as BoardColumnType, BoardCard, BoardPhase } from '../../shared/grammar/types.js';
import { Card } from './Card.js';

const PHASE_ACCENT_COLOR: Record<string, string> = {
  unclaimed: 'var(--phase-unclaimed)',
  planning: 'var(--phase-planning)',
  speccing: 'var(--phase-speccing)',
  implementing: 'var(--phase-implementing)',
  verifying: 'var(--phase-verifying)',
  done: 'var(--phase-done)',
};

interface ColumnProps {
  column: BoardColumnType;
  onCardClick?: (card: BoardCard) => void;
  currentUser?: string;
  branch?: string;
  onConflict?: (claimedBy: string) => void;
  validDropTargets?: Set<BoardPhase>;
  draggingCardId?: string;
  onDrop?: (cardId: string, fromPhase: BoardPhase, toPhase: BoardPhase) => void;
  onCardDragStart?: (cardId: string, fromPhase: BoardPhase) => void;
  onCardDragEnd?: () => void;
  onAddCard?: (phase: BoardPhase) => void;
  focusedCardId?: string;
  collapsed?: boolean;
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
  const accentColor = PHASE_ACCENT_COLOR[column.phase] ?? 'var(--phase-unclaimed)';
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

  const dropClass = isDragOver && isValidTarget
    ? 'wh-drag-over'
    : isValidTarget
      ? 'wh-drag-target'
      : isInvalidTarget
        ? 'wh-drag-invalid'
        : '';

  if (collapsed) {
    return (
      <div
        className={`wh-column flex flex-col min-w-[48px] max-w-[48px] transition-all ${dropClass}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Accent bar */}
        <div
          className="h-1 rounded-t-[inherit]"
          style={{ background: accentColor }}
        />
        <div className="flex flex-col items-center py-3 gap-2">
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="text-[0.7rem] leading-none transition-colors"
              style={{ color: 'var(--color-text-muted)' }}
              title="Expand column"
            >
              &#9656;
            </button>
          )}
          <span
            className="font-heading text-[0.65rem] font-semibold rounded-full px-1.5 py-0.5"
            style={{ background: 'var(--column-bg)', color: 'var(--color-text-muted)' }}
          >
            {column.cards.length}
          </span>
          <span
            className="font-heading text-[0.7rem] font-semibold whitespace-nowrap"
            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', color: 'var(--color-text-secondary)' }}
          >
            {column.title}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`wh-column flex flex-col transition-all ${dropClass}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Phase accent bar */}
      <div
        className="h-1 rounded-t-[inherit]"
        style={{ background: accentColor }}
      />

      {/* Column header */}
      <div className="px-3.5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="text-[0.7rem] leading-none transition-colors"
              style={{ color: 'var(--color-text-muted)' }}
              title="Collapse column"
            >
              &#9662;
            </button>
          )}
          <h2
            className="font-heading text-[0.8rem] font-semibold tracking-wide uppercase"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {column.title}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {onAddCard && (
            <button
              type="button"
              onClick={() => onAddCard(column.phase)}
              className="w-5 h-5 flex items-center justify-center rounded text-[0.8rem] leading-none transition-all"
              style={{ color: 'var(--color-text-muted)' }}
              title="Add card"
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--color-primary)';
                e.currentTarget.style.background = 'var(--color-primary-subtle)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--color-text-muted)';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              +
            </button>
          )}
          <span
            className="font-heading text-[0.65rem] font-semibold rounded-full px-2 py-0.5"
            style={{
              background: 'var(--column-bg)',
              color: 'var(--color-text-muted)',
            }}
          >
            {column.cards.length}
          </span>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto px-2.5 pb-2.5 space-y-2 wh-stagger">
        {column.cards.length === 0 ? (
          <p
            className="text-[0.75rem] text-center py-8 font-heading"
            style={{ color: 'var(--color-text-muted)' }}
          >
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
          <div
            className="h-0.5 rounded mx-2"
            style={{ background: 'var(--color-primary)' }}
          />
        )}
      </div>
    </div>
  );
}
