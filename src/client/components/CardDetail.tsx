/**
 * Card Detail Panel
 *
 * Displays full card detail with spec file contents.
 * Supports inline editing and task checkbox toggling.
 */

import React, { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { CardDetailResponse } from '../api.js';
import { saveSpecFile, renameCard, deleteCard, updateCardMetadata } from '../api.js';
import { MarkdownEditor } from './MarkdownEditor.js';
import { CardTimeline } from './CardTimeline.js';
import { CommentThread } from './CommentThread.js';
import { PRPanel } from './PRPanel.js';
import { WorkflowPanel } from './WorkflowPanel.js';

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

  // Metadata editing state
  const cardMeta = card.metadata;
  const [metaPriority, setMetaPriority] = useState<string>(cardMeta?.priority ?? '');
  const [metaDue, setMetaDue] = useState<string>(cardMeta?.due ?? '');
  const [metaLabels, setMetaLabels] = useState<string[]>(cardMeta?.labels ?? []);
  const [newLabel, setNewLabel] = useState('');
  const [metaSaving, setMetaSaving] = useState(false);

  const handleMetaSave = useCallback(async () => {
    setError(null);
    setMetaSaving(true);
    try {
      await updateCardMetadata(
        card.id,
        {
          priority: metaPriority || undefined,
          due: metaDue || undefined,
          labels: metaLabels,
        },
        branch,
      );
      void queryClient.invalidateQueries({ queryKey: ['card'] });
      void queryClient.invalidateQueries({ queryKey: ['board'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save metadata');
    } finally {
      setMetaSaving(false);
    }
  }, [card.id, metaPriority, metaDue, metaLabels, branch, queryClient]);

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
        <div className="rounded-lg p-4 text-sm space-y-0.5" style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-text)' }}>
          {lines.map((line, idx) => {
            const isChecked = line.includes('- [x]');
            const isCheckbox = line.includes('- [x]') || line.includes('- [ ]');
            if (isCheckbox) {
              const label = line.replace(/^(\s*)-\s*\[[ x]\]\s*/, '');
              return (
                <label key={idx} className="flex items-start gap-2 cursor-pointer px-1 py-0.5 rounded transition-colors" style={{ ['--hover-bg' as string]: 'var(--color-surface-hover)' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => void handleCheckboxToggle(fileName, idx, content)}
                    className="mt-0.5 accent-[var(--color-primary)]"
                  />
                  <span style={isChecked ? { textDecoration: 'line-through', color: 'var(--color-text-muted)' } : undefined}>{label}</span>
                </label>
              );
            }
            return <div key={idx} className="whitespace-pre-wrap">{line}</div>;
          })}
        </div>
      );
    }

    return (
      <pre className="font-mono rounded-lg p-4 text-sm overflow-x-auto whitespace-pre-wrap" style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-text)' }}>
        {content}
      </pre>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="wh-animate-in w-full max-w-2xl overflow-y-auto flex flex-col shadow-2xl" style={{ background: 'var(--color-surface)' }}>
        {/* Header */}
        <div className="sticky top-0 z-10 px-6 py-4" style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
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
                    className="wh-input text-lg font-heading font-semibold w-full"
                    autoFocus
                  />
                  <button type="submit" className="wh-btn wh--btn-primary text-[0.7rem]" style={{ background: 'var(--color-primary)', color: 'white', borderColor: 'var(--color-primary)' }}>Save</button>
                  <button type="button" onClick={() => { setIsRenaming(false); setRenameTitle(card.title); }} className="wh-btn text-[0.7rem]">Cancel</button>
                </form>
              ) : (
                <h2
                  className="font-heading text-lg font-semibold cursor-pointer transition-colors"
                  style={{ color: 'var(--color-text)' }}
                  onClick={() => setIsRenaming(true)}
                  title="Click to rename"
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-primary)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text)'; }}
                >
                  {card.title}
                </h2>
              )}
              <p className="font-mono text-[0.7rem] mt-1" style={{ color: 'var(--color-text-muted)' }}>
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
                className="text-[0.7rem] font-medium px-2.5 py-1 rounded-md border transition-colors"
                style={{ borderColor: 'rgba(239,68,68,0.3)', color: '#f87171' }}
                title="Delete card"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={onClose}
                className="text-2xl leading-none transition-colors"
                style={{ color: 'var(--color-text-muted)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-muted)'; }}
              >
                &times;
              </button>
            </div>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-6 mt-2 px-3 py-2 rounded-lg text-sm flex items-center justify-between" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
            <span className="font-medium">{error}</span>
            <button type="button" onClick={() => setError(null)} className="text-red-400 hover:text-red-300 ml-2">&times;</button>
          </div>
        )}

        {/* Metadata section */}
        <div className="px-6 py-4 space-y-3" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
          <h3 className="font-heading text-[0.75rem] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Metadata</h3>
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1">
              <span className="font-heading text-[0.65rem] font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Priority</span>
              <select
                value={metaPriority}
                onChange={(e) => setMetaPriority(e.target.value)}
                className="wh-input text-[0.8rem]"
              >
                <option value="">None</option>
                <option value="P0">P0</option>
                <option value="P1">P1</option>
                <option value="P2">P2</option>
                <option value="P3">P3</option>
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-heading text-[0.65rem] font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Due date</span>
              <input
                type="date"
                value={metaDue}
                onChange={(e) => setMetaDue(e.target.value)}
                className="wh-input text-[0.8rem]"
              />
            </label>

            <button
              type="button"
              onClick={() => void handleMetaSave()}
              disabled={metaSaving}
              className="wh-btn wh-btn-primary disabled:opacity-50"
            >
              {metaSaving ? 'Saving...' : 'Save Metadata'}
            </button>
          </div>

          {/* Labels */}
          <div className="space-y-1.5">
            <span className="font-heading text-[0.65rem] font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Labels</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {metaLabels.map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1 text-[0.7rem] font-medium px-2.5 py-0.5 rounded-full"
                  style={{
                    background: 'var(--color-primary-subtle)',
                    color: 'var(--color-primary)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  {label}
                  <button
                    type="button"
                    onClick={() => setMetaLabels((prev) => prev.filter((l) => l !== label))}
                    className="leading-none opacity-60 hover:opacity-100 transition-opacity"
                  >
                    &times;
                  </button>
                </span>
              ))}
              <form
                className="inline-flex items-center gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  const trimmed = newLabel.trim();
                  if (trimmed && !metaLabels.includes(trimmed)) {
                    setMetaLabels((prev) => [...prev, trimmed]);
                  }
                  setNewLabel('');
                }}
              >
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Add label..."
                  className="wh-input text-[0.7rem] w-24"
                />
              </form>
            </div>
          </div>
        </div>

        {/* PR Panel */}
        <PRPanel cardId={card.id} />

        {/* Workflow Panel */}
        <WorkflowPanel
          cardId={card.id}
          specDir={specDir}
          phase={card.phase}
          branch={branch}
        />

        {/* Spec contents */}
        <div className="flex-1 px-6 py-4 space-y-6">
          {editingFile && specContents?.[editingFile] !== undefined ? (
            <div className="h-96 rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
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
                  <h3 className="font-heading text-[0.8rem] font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>&#128196;</span>
                    {fileName}
                  </h3>
                  {specDir && EDITABLE_FILES.has(fileName) && (
                    <button
                      type="button"
                      onClick={() => setEditingFile(fileName)}
                      className="wh-btn text-[0.7rem]"
                    >
                      Edit
                    </button>
                  )}
                </div>
                {renderContent(fileName, content)}
              </div>
            ))
          ) : (
            <p className="text-center py-8 font-heading" style={{ color: 'var(--color-text-muted)' }}>
              No spec files available for this card.
            </p>
          )}

          {/* Card Timeline */}
          {card.specEntry && (
            <CardTimeline cardId={card.id} branch={branch} />
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
