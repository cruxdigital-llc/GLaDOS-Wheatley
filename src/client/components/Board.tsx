/**
 * Board Component
 *
 * Main Kanban board layout with columns for each GLaDOS phase.
 * Includes user identity input, filter controls, and claim conflict handling.
 */

import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { BoardCard, BoardColumn } from '../../shared/grammar/types.js';
import { useBoard, useCardDetail } from '../hooks/use-board.js';
import { Column } from './Column.js';
import { CardDetail } from './CardDetail.js';
import { BranchSelector } from './BranchSelector.js';
import { ConflictModal } from './ConflictModal.js';

type FilterMode = 'all' | 'unclaimed' | 'mine';

export function Board() {
  const queryClient = useQueryClient();

  const [branch, setBranch] = useState<string | undefined>();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<string>(
    () => localStorage.getItem('wheatley_claimant') ?? '',
  );
  const [filter, setFilter] = useState<FilterMode>('all');
  const [conflictInfo, setConflictInfo] = useState<{ claimedBy: string } | null>(null);
  const [userNameWarning, setUserNameWarning] = useState<string | null>(null);

  const { data: board, isLoading, error } = useBoard(branch);
  const { data: cardDetail } = useCardDetail(selectedCardId, branch);

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

  const filteredColumns = useMemo<BoardColumn[]>(() => {
    if (!board) return [];

    if (filter === 'unclaimed') {
      return board.columns.filter((col) => col.phase === 'unclaimed');
    }

    if (filter === 'mine') {
      return board.columns
        .map((col) => ({
          ...col,
          cards: col.cards.filter(
            (card) => card.claim?.claimant === currentUser,
          ),
        }))
        .filter((col) => col.cards.length > 0);
    }

    return board.columns;
  }, [board, filter, currentUser]);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-full mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">Wheatley</h1>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            {board && (
              <div className="text-xs text-gray-500">
                {board.metadata.totalCards} cards &middot;{' '}
                {board.metadata.completedCount} done &middot;{' '}
                {board.metadata.claimedCount} claimed
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

            <BranchSelector selectedBranch={branch} onBranchChange={setBranch} />
          </div>
        </div>
      </header>

      {/* Board */}
      <main className="p-4 overflow-x-auto">
        {isLoading && (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-400 text-lg">Loading board…</div>
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
            {filteredColumns.map((column) => (
              <Column
                key={column.phase}
                column={column}
                onCardClick={handleCardClick}
                currentUser={currentUser}
                branch={branch}
                onConflict={handleConflict}
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

      {/* Claim Conflict Modal */}
      {conflictInfo && (
        <ConflictModal
          claimedBy={conflictInfo.claimedBy}
          onRefresh={handleConflictRefresh}
          onClose={handleConflictClose}
        />
      )}
    </div>
  );
}
