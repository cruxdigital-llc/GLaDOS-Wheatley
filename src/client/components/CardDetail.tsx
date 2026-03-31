/**
 * Card Detail Panel
 *
 * Displays full card detail with spec file contents.
 * Supports inline editing and task checkbox toggling.
 */

import React, { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { CardDetailResponse } from '../api.js';
import { saveSpecFile, renameCard, deleteCard } from '../api.js';
import { MarkdownEditor } from './MarkdownEditor.js';
import { CommentThread } from './CommentThread.js';

interface CardDetailProps {
  detail: CardDetailResponse;
  branch?: string;
  currentUser?: string;
  onClose: () => void;
}

/** Editable spec file names. */
const EDITABLE_FILES = new Set([
  'README.md', 'spec.md', 'plan.md', 'requirements.md', 'tasks.md',
]);

export function CardDetail({ detail, branch, currentUser, onClose }: CardDetailProps) {
  const { card, specContents } = detail;
  const queryClient = useQueryClient();
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameTitle, setRenameTitle] = useState(card.title);
  const [error, setError] = useState<string | null>(null);

  const specDir = card.specEntry?.dirName;

  const handleSave = useCallback(async (fileName: string, content: string) => {
    if (!specDir) return;
    setError(null);
    try {
      await saveSpecFile(specDir, fileName, content, branch);
      void queryClient.invalidateQueries({ queryKey: ['card'] });
      void queryClient.invalidateQueries({ queryKey: ['board'] });
      setEditingFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save file');
    }
  }, [specDir, branch, queryClient]);

  const handleCheckboxToggle = useCallback(async (fileName: string, lineIndex: number, fileContent: string) => {
    if (!specDir) return;
    const lines = fileContent.split('\n');
    const line = lines[lineIndex];
    if (!line) return;

    // Toggle [x] <-> [ ]
    if (line.includes('- [x]')) {
      lines[lineIndex] = line.replace('- [x]', '- [ ]');
    } else if (line.includes('- [ ]')) {
      lines[lineIndex] = line.replace('- [ ]', '- [x]');
    } else {
      return;
    }

    setError(null);
    try {
      const newContent = lines.join('\n');
      await saveSpecFile(specDir, fileName, newContent, branch);
      void queryClient.invalidateQueries({ queryKey: ['card'] });
      void queryClient.invalidateQueries({ queryKey: ['board'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle checkbox');
    }
  }, [specDir, branch, queryClient]);

  const renderContent = (fileName: string, content: string) => {
    // For tasks.md, render checkboxes as interactive
    if (fileName === 'tasks.md') {
      const lines = content.split('\n');
      return (
        <div className="bg-gray-50 border rounded-lg p-4 text-sm text-gray-800 space-y-0.5">
          {lines.map((line, idx) => {
            const isChecked = line.includes('- [x]');
            const isCheckbox = line.includes('- [x]') || line.includes('- [ ]');
            if (isCheckbox) {
              const label = line.replace(/^(\s*)-\s*\[[ x]\]\s*/, '');
              return (
                <label key={idx} className="flex items-start gap-2 cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => void handleCheckboxToggle(fileName, idx, content)}
                    className="mt-0.5"
                  />
                  <span className={isChecked ? 'line-through text-gray-400' : ''}>{label}</span>
                </label>
              );
            }
            return <div key={idx} className="whitespace-pre-wrap">{line}</div>;
          })}
        </div>
      );
    }

    return (
      <pre className="bg-gray-50 border rounded-lg p-4 text-sm text-gray-800 overflow-x-auto whitespace-pre-wrap">
        {content}
      </pre>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-end z-50">
      <div className="w-full max-w-2xl bg-white shadow-xl overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              {isRenaming ? (
                <form
                  className="flex items-center gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setError(null);
                    try {
                      if (renameTitle.trim() && renameTitle !== card.title) {
                        await renameCard(card.id, renameTitle.trim(), branch);
                        void queryClient.invalidateQueries({ queryKey: ['board'] });
                        void queryClient.invalidateQueries({ queryKey: ['card'] });
                      }
                      setIsRenaming(false);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Failed to rename card');
                    }
                  }}
                >
                  <input
                    type="text"
                    value={renameTitle}
                    onChange={(e) => setRenameTitle(e.target.value)}
                    className="text-lg font-semibold text-gray-900 border-b-2 border-blue-400 focus:outline-none w-full"
                    autoFocus
                  />
                  <button type="submit" className="text-xs px-2 py-1 rounded bg-blue-600 text-white">Save</button>
                  <button type="button" onClick={() => { setIsRenaming(false); setRenameTitle(card.title); }} className="text-xs px-2 py-1 rounded border text-gray-500">Cancel</button>
                </form>
              ) : (
                <h2
                  className="text-lg font-semibold text-gray-900 cursor-pointer hover:text-blue-600"
                  onClick={() => setIsRenaming(true)}
                  title="Click to rename"
                >
                  {card.title}
                </h2>
              )}
              <p className="text-sm text-gray-500">
                {card.id} &middot; {card.phase} &middot; {card.source}
              </p>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <button
                type="button"
                onClick={async () => {
                  if (confirm(`Delete card "${card.title}"?`)) {
                    setError(null);
                    try {
                      await deleteCard(card.id, branch);
                      void queryClient.invalidateQueries({ queryKey: ['board'] });
                      onClose();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Failed to delete card');
                    }
                  }
                }}
                className="text-xs px-2 py-1 rounded border border-red-200 text-red-500 hover:bg-red-50"
                title="Delete card"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                &times;
              </button>
            </div>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-6 mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-600 flex items-center justify-between">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-2">&times;</button>
          </div>
        )}

        {/* Spec contents */}
        <div className="flex-1 px-6 py-4 space-y-6">
          {editingFile && specContents?.[editingFile] !== undefined ? (
            <div className="h-96 border rounded-lg overflow-hidden">
              <MarkdownEditor
                initialContent={specContents[editingFile]}
                fileName={editingFile}
                onSave={(content) => handleSave(editingFile, content)}
                onCancel={() => setEditingFile(null)}
              />
            </div>
          ) : specContents && Object.keys(specContents).length > 0 ? (
            Object.entries(specContents).map(([fileName, content]) => (
              <div key={fileName}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <span className="text-gray-400">&#128196;</span>
                    {fileName}
                  </h3>
                  {specDir && EDITABLE_FILES.has(fileName) && (
                    <button
                      type="button"
                      onClick={() => setEditingFile(fileName)}
                      className="text-xs px-2 py-0.5 rounded border border-gray-300 text-gray-500 hover:bg-gray-50"
                    >
                      Edit
                    </button>
                  )}
                </div>
                {renderContent(fileName, content)}
              </div>
            ))
          ) : (
            <p className="text-gray-400 text-center py-8">
              No spec files available for this card.
            </p>
          )}

          {/* Comment thread */}
          {specDir && (
            <CommentThread specDir={specDir} branch={branch} currentUser={currentUser ?? ''} />
          )}
        </div>
      </div>
    </div>
  );
}
