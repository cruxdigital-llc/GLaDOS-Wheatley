/**
 * Board Column Component
 *
 * Displays a phase column with its cards.
 */

import React from 'react';
import type { BoardColumn as BoardColumnType, BoardCard } from '../../shared/grammar/types.js';
import { Card } from './Card.js';

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
}

export function Column({ column, onCardClick }: ColumnProps) {
  const borderColor = COLUMN_HEADER_COLORS[column.phase] ?? 'border-t-gray-400';

  return (
    <div className={`flex flex-col bg-gray-50 rounded-lg border-t-4 ${borderColor} min-w-[280px] max-w-[320px]`}>
      <div className="px-3 py-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">{column.title}</h2>
        <span className="text-xs text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded-full">
          {column.cards.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
        {column.cards.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">No items</p>
        ) : (
          column.cards.map((card) => (
            <Card key={card.id} card={card} onClick={onCardClick} />
          ))
        )}
      </div>
    </div>
  );
}
