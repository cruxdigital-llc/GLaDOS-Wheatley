/**
 * Comment Thread
 *
 * Displays comments on a spec and provides a form to add new ones.
 */

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchComments, addComment, type CommentEntry } from '../api.js';

interface Props {
  specDir: string;
  branch?: string;
  currentUser: string;
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export function CommentThread({ specDir, branch, currentUser }: Props) {
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data } = useQuery({
    queryKey: ['comments', specDir, branch],
    queryFn: () => fetchComments(specDir, branch),
  });

  const comments = data?.comments ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !currentUser) return;
    setSubmitting(true);
    try {
      await addComment(specDir, currentUser, newComment.trim(), branch);
      setNewComment('');
      void queryClient.invalidateQueries({ queryKey: ['comments', specDir] });
    } catch {
      // Silently fail
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border-t mt-6 pt-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Comments</h3>

      {comments.length === 0 && (
        <p className="text-xs text-gray-400 mb-3">No comments yet.</p>
      )}

      <div className="space-y-3 mb-4">
        {comments.map((c, idx) => (
          <div key={idx} className="bg-gray-50 rounded p-3 text-sm">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-gray-700">{c.author}</span>
              <span className="text-xs text-gray-400">{formatTimestamp(c.timestamp)}</span>
            </div>
            <p className="text-gray-600 whitespace-pre-wrap">{c.body}</p>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={currentUser ? 'Add a comment…' : 'Set your name to comment'}
          disabled={!currentUser}
          maxLength={5000}
          className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!newComment.trim() || !currentUser || submitting}
          className="px-3 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? '…' : 'Post'}
        </button>
      </form>
    </div>
  );
}
