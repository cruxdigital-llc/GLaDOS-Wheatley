/**
 * Undo/Redo Hook
 *
 * In-memory action stack for recent board actions with undo/redo support.
 */

import { useState, useCallback, useRef } from 'react';

export interface UndoableAction {
  id: string;
  description: string;
  timestamp: number;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

const MAX_STACK_SIZE = 20;

export function useUndoRedo() {
  const undoStackRef = useRef<UndoableAction[]>([]);
  const redoStackRef = useRef<UndoableAction[]>([]);
  const [version, setVersion] = useState(0);

  const pushAction = useCallback((action: UndoableAction) => {
    undoStackRef.current.push(action);
    if (undoStackRef.current.length > MAX_STACK_SIZE) {
      undoStackRef.current.shift();
    }
    // Clear redo stack on new action
    redoStackRef.current = [];
    setVersion((v) => v + 1);
  }, []);

  const undo = useCallback(async () => {
    const action = undoStackRef.current.pop();
    if (!action) return;
    try {
      await action.undo();
      redoStackRef.current.push(action);
    } catch {
      // If undo fails, put it back
      undoStackRef.current.push(action);
    }
    setVersion((v) => v + 1);
  }, []);

  const redo = useCallback(async () => {
    const action = redoStackRef.current.pop();
    if (!action) return;
    try {
      await action.redo();
      undoStackRef.current.push(action);
    } catch {
      redoStackRef.current.push(action);
    }
    setVersion((v) => v + 1);
  }, []);

  return {
    pushAction,
    undo,
    redo,
    canUndo: undoStackRef.current.length > 0,
    canRedo: redoStackRef.current.length > 0,
    undoDescription: undoStackRef.current.at(-1)?.description,
    redoDescription: redoStackRef.current.at(-1)?.description,
    version, // trigger re-renders
  };
}
