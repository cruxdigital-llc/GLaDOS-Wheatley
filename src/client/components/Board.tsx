/**
 * Board Component
 *
 * Main Kanban board layout with columns for each GLaDOS phase.
 */

import React, { useState } from 'react';
import type { BoardCard } from '../../shared/grammar/types.js';
import { useBoard, useCardDetail } from '../hooks/use-board.js';
import { Column } from './Column.js';
import { CardDetail } from './CardDetail.js';
import { BranchSelector } from './BranchSelector.js';

export function Board() {
  const [branch, setBranch] = useState<string | undefined>();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const { data: board, isLoading, error } = useBoard(branch);
  const { data: cardDetail } = useCardDetail(selectedCardId, branch);

  const handleCardClick = (card: BoardCard) => {
    setSelectedCardId(card.id);
  };

  const handleCloseDetail = () => {
    setSelectedCardId(null);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-full mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">Wheatley</h1>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
              Read-Only Board
            </span>
          </div>

          <div className="flex items-center gap-4">
            {board && (
              <div className="text-xs text-gray-500">
                {board.metadata.totalCards} cards &middot;{' '}
                {board.metadata.completedCount} done &middot;{' '}
                {board.metadata.claimedCount} claimed
              </div>
            )}
            <BranchSelector selectedBranch={branch} onBranchChange={setBranch} />
          </div>
        </div>
      </header>

      {/* Board */}
      <main className="p-4 overflow-x-auto">
        {isLoading && (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-400 text-lg">Loading board...</div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-64">
            <div className="text-red-500 text-center">
              <p className="text-lg font-medium">Failed to load board</p>
              <p className="text-sm mt-1">{(error as Error).message}</p>
            </div>
          </div>
        )}

        {board && (
          <div className="flex gap-4 min-h-[calc(100vh-120px)]">
            {board.columns.map((column) => (
              <Column
                key={column.phase}
                column={column}
                onCardClick={handleCardClick}
              />
            ))}
          </div>
        )}

        {board && board.metadata.totalCards === 0 && (
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
    </div>
  );
}
