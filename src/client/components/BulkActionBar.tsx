/**
 * Bulk Action Bar
 *
 * Appears when cards are selected in multi-select mode.
 * Provides bulk move, assign, label/priority, and delete actions.
 */

import React, { useState } from 'react';
import type { BoardPhase } from '../../shared/grammar/types.js';
import { bulkMove, bulkAssign, bulkUpdateMetadata, bulkDelete } from '../api.js';

interface BulkActionBarProps {
  selectedIds: Set<string>;
  currentPhase?: BoardPhase;
  currentUser: string;
  branch?: string;
  onDone: () => void;
  onClearSelection: () => void;
}

const PHASES: BoardPhase[] = ['unclaimed', 'planning', 'speccing', 'implementing', 'verifying', 'done'];

export function BulkActionBar({
  selectedIds,
  currentPhase,
  currentUser,
  branch,
  onDone,
  onClearSelection,
}: BulkActionBarProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [showMetadataMenu, setShowMetadataMenu] = useState(false);

  const ids = Array.from(selectedIds);
  const count = ids.length;

  if (count === 0) return null;

  const handleBulkMove = async (to: BoardPhase) => {
    setLoading(true);
    setError(null);
    try {
      const from = currentPhase ?? 'unclaimed';
      await bulkMove(ids, from, to, branch);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk move failed');
    } finally {
      setLoading(false);
      setShowMoveMenu(false);
    }
  };

  const handleBulkAssign = async () => {
    if (!currentUser.trim()) {
      setError('Set your name first');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await bulkAssign(ids, currentUser);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk assign failed');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkPriority = async (priority: string) => {
    setLoading(true);
    setError(null);
    try {
      await bulkUpdateMetadata(ids, { priority }, branch);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk metadata update failed');
    } finally {
      setLoading(false);
      setShowMetadataMenu(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${count} card(s)? This cannot be undone.`)) return;
    setLoading(true);
    setError(null);
    try {
      await bulkDelete(ids, branch);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk delete failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl px-4 py-3 flex items-center gap-3">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {count} selected
      </span>

      <div className="h-5 border-l border-gray-300 dark:border-gray-600" />

      {/* Move */}
      <div className="relative">
        <button
          type="button"
          disabled={loading}
          onClick={() => setShowMoveMenu((v) => !v)}
          className="text-sm px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Move
        </button>
        {showMoveMenu && (
          <div className="absolute bottom-full mb-1 left-0 bg-white dark:bg-gray-800 border rounded shadow-lg py-1 min-w-[140px]">
            {PHASES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handleBulkMove(p)}
                className="block w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 capitalize"
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Assign */}
      <button
        type="button"
        disabled={loading}
        onClick={handleBulkAssign}
        className="text-sm px-3 py-1.5 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
      >
        Assign to me
      </button>

      {/* Priority */}
      <div className="relative">
        <button
          type="button"
          disabled={loading}
          onClick={() => setShowMetadataMenu((v) => !v)}
          className="text-sm px-3 py-1.5 rounded bg-yellow-600 text-white hover:bg-yellow-700 disabled:opacity-50"
        >
          Priority
        </button>
        {showMetadataMenu && (
          <div className="absolute bottom-full mb-1 left-0 bg-white dark:bg-gray-800 border rounded shadow-lg py-1 min-w-[100px]">
            {['P0', 'P1', 'P2', 'P3'].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handleBulkPriority(p)}
                className="block w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Delete */}
      <button
        type="button"
        disabled={loading}
        onClick={handleBulkDelete}
        className="text-sm px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
      >
        Delete
      </button>

      <div className="h-5 border-l border-gray-300 dark:border-gray-600" />

      {/* Clear */}
      <button
        type="button"
        onClick={onClearSelection}
        className="text-sm px-2 py-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
      >
        Clear
      </button>

      {error && (
        <span className="text-xs text-red-500 ml-2">{error}</span>
      )}

      {loading && (
        <span className="text-xs text-gray-400 animate-pulse">Working...</span>
      )}
    </div>
  );
}
