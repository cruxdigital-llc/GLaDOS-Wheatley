/**
 * Markdown Editor
 *
 * Textarea with save button. Used for editing spec files inline.
 */

import React, { useState, useEffect } from 'react';

interface Props {
  initialContent: string;
  fileName: string;
  onSave: (content: string) => Promise<void>;
  onCancel: () => void;
}

export function MarkdownEditor({ initialContent, fileName, onSave, onCancel }: Props) {
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDirty = content !== initialContent;

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(content);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-2 py-1 bg-gray-50 border-b text-xs text-gray-500">
        <span>Editing: {fileName}</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-2 py-0.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="px-2 py-0.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      {error && (
        <div className="px-2 py-1 bg-red-50 text-red-700 text-xs border-b border-red-200">
          {error}
        </div>
      )}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="flex-1 w-full p-3 font-mono text-sm resize-none focus:outline-none"
        spellCheck={false}
      />
    </div>
  );
}
