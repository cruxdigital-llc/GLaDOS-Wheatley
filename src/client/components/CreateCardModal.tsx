/**
 * Create Card Modal
 *
 * Simple form for creating a new card. Appears when clicking "+" on a column.
 */

import React, { useState } from 'react';
import type { BoardPhase } from '../../shared/grammar/types.js';

interface Props {
  targetPhase: BoardPhase;
  onConfirm: (title: string) => void;
  onCancel: () => void;
}

export function CreateCardModal({ targetPhase, onConfirm, onCancel }: Props) {
  const [title, setTitle] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onConfirm(title.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-lg shadow-lg p-6 w-96 max-w-[90vw]">
        <h2 className="text-lg font-semibold mb-3">New Card</h2>
        <p className="text-sm text-gray-500 mb-4">
          Creating in <span className="font-medium capitalize">{targetPhase}</span> column
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Card title…"
            maxLength={200}
            autoFocus
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
