/**
 * Conflict Modal
 *
 * Displayed when a claim attempt returns 409 (item already claimed by someone else).
 * Rendered via a portal so it sits above all other content.
 */

import React from 'react';
import ReactDOM from 'react-dom';

interface ConflictModalProps {
  claimedBy: string;
  onRefresh: () => void;
  onClose: () => void;
}

export function ConflictModal({ claimedBy, onRefresh, onClose }: ConflictModalProps) {
  return ReactDOM.createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Already Claimed</h2>
        <p className="text-sm text-gray-600 mb-6">
          This item is already claimed by{' '}
          <span className="font-medium text-gray-900">{claimedBy}</span>.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Refresh Board
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
