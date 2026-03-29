/**
 * Keyboard Shortcuts Hook
 *
 * Registers global keyboard event listeners for board navigation
 * and actions. Skips shortcuts when input elements are focused
 * (unless ignoreInputs is explicitly set to false).
 */

import { useEffect, useRef } from 'react';

export interface ShortcutDef {
  key: string;
  description: string;
  handler: () => void;
  /** If true (default), only fires when no input/textarea is focused */
  ignoreInputs?: boolean;
}

/** Tags whose focus should suppress keyboard shortcuts by default. */
const INPUT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export function useKeyboardShortcuts(shortcuts: ShortcutDef[]): void {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const active = document.activeElement;
      const isInputFocused =
        active != null &&
        (INPUT_TAGS.has(active.tagName) ||
          (active as HTMLElement).isContentEditable);

      for (const shortcut of shortcutsRef.current) {
        if (shortcut.key !== e.key) continue;

        const ignoreInputs = shortcut.ignoreInputs ?? true;
        if (ignoreInputs && isInputFocused) continue;

        e.preventDefault();
        shortcut.handler();
        return;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
}
