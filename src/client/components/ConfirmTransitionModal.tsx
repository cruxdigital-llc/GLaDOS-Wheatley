/**
 * Confirm Transition Modal
 *
 * Shown before phase transitions that create files in the repository.
 * The user must confirm before the transition is executed.
 */

import React from 'react';
import ReactDOM from 'react-dom';
import type { BoardPhase } from '../../shared/grammar/types.js';

interface ConfirmTransitionModalProps {
  cardId: string;
  cardTitle: string;
  from: BoardPhase;
  to: BoardPhase;
  onConfirm: () => void;
  onCancel: () => void;
}

const PHASE_LABELS: Record<BoardPhase, string> = {
  unclaimed: 'Unclaimed',
  planning: 'Planning',
  speccing: 'Speccing',
  implementing: 'Implementing',
  verifying: 'Verifying',
  done: 'Done',
};

const FILE_DESCRIPTIONS: Partial<Record<string, string>> = {
  'unclaimed→planning': 'a README.md in a new spec directory',
  'planning→speccing': 'spec.md and requirements.md files',
  'speccing→implementing': 'a tasks.md file',
  'unclaimed→implementing': 'a README.md and tasks.md in a new spec directory',
};

export function ConfirmTransitionModal({
  cardId,
  cardTitle,
  from,
  to,
  onConfirm,
  onCancel,
}: ConfirmTransitionModalProps) {
  const key = `${from}→${to}`;
  const fileDesc = FILE_DESCRIPTIONS[key] ?? 'new files';

  return ReactDOM.createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Confirm Transition</h2>
        <p className="text-sm text-gray-500 mb-4 truncate" title={cardId}>
          {cardTitle || cardId}
        </p>

        <p className="text-sm text-gray-700 mb-2">
          Moving from{' '}
          <span className="font-medium">{PHASE_LABELS[from]}</span>
          {' '}to{' '}
          <span className="font-medium">{PHASE_LABELS[to]}</span>
          {' '}will create {fileDesc} in the repository.
        </p>
        <p className="text-sm text-gray-500 mb-6">
          This will be committed to the repository. Continue?
        </p>

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
