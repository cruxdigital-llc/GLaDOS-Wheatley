/**
 * Shortcut Overlay Component
 *
 * Full-screen modal overlay that displays all available keyboard shortcuts.
 * Rendered via a portal so it sits above all other content.
 */

import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';

interface ShortcutOverlayProps {
  shortcuts: { key: string; description: string }[];
  onClose: () => void;
}

export function ShortcutOverlay({ shortcuts, onClose }: ShortcutOverlayProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Keyboard Shortcuts</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-sm"
          >
            Esc
          </button>
        </div>

        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          {shortcuts.map((s) => (
            <React.Fragment key={s.key}>
              <kbd className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 text-xs font-mono font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded shadow-sm">
                {s.key}
              </kbd>
              <span className="text-sm text-gray-600 flex items-center">{s.description}</span>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
