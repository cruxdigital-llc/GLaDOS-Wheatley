/**
 * Board Card Component
 *
 * Displays a single task card with title, phase badge, and claim info.
 */

import React from 'react';
import type { BoardCard } from '../../shared/grammar/types.js';

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
}

export function Card({ card, onClick }: CardProps) {
  const phaseColor = PHASE_COLORS[card.phase] ?? 'bg-gray-100 text-gray-700';

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

      {card.claim && (
        <div className="mt-2 text-xs text-gray-500">
          Claimed by <span className="font-medium text-gray-700">{card.claim.claimant}</span>
        </div>
      )}

      {card.statusTask && (
        <div className="mt-1 text-xs text-gray-400 truncate">
          {card.statusTask.description}
        </div>
      )}
    </button>
  );
}
