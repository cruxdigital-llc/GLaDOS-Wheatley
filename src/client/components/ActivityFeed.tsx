/**
 * Activity Feed Panel
 *
 * Slide-in panel showing real-time agent and human activity.
 */

import React, { useState } from 'react';
import { useActivityFeed } from '../hooks/use-activity.js';
import type { TraceEntry, AgentIdentity } from '../../shared/grammar/types.js';

interface ActivityFeedProps {
  onClose: () => void;
}

const ACTION_LABELS: Record<string, string> = {
  claim: 'Claimed',
  release: 'Released',
  transition: 'Transitioned',
  'file-create': 'Created file',
  'file-edit': 'Edited file',
  commit: 'Committed',
  comment: 'Commented',
};

const IDENTITY_BADGE: Record<AgentIdentity, { label: string; className: string }> = {
  agent: { label: 'AI', className: 'bg-purple-100 text-purple-700' },
  human: { label: 'Human', className: 'bg-blue-100 text-blue-700' },
  unknown: { label: '?', className: 'bg-gray-100 text-gray-500' },
};

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function TraceRow({ entry }: { entry: TraceEntry }) {
  const badge = IDENTITY_BADGE[entry.actorType];
  return (
    <div className="flex items-start gap-2 py-2 border-b border-gray-100 last:border-b-0">
      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${badge.className} shrink-0 mt-0.5`}>
        {badge.label}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-gray-800">
          <span className="font-medium">{entry.actor}</span>
          {' '}
          <span className="text-gray-500">{ACTION_LABELS[entry.action] ?? entry.action}</span>
          {' '}
          <span className="font-mono text-xs text-gray-600 truncate">{entry.target}</span>
        </div>
        {entry.detail && (
          <div className="text-xs text-gray-400 mt-0.5 truncate">{entry.detail}</div>
        )}
      </div>
      <span className="text-xs text-gray-400 shrink-0">{formatTimestamp(entry.timestamp)}</span>
    </div>
  );
}

export function ActivityFeed({ onClose }: ActivityFeedProps) {
  const [actorFilter, setActorFilter] = useState<string>('');
  const { data, isLoading } = useActivityFeed(
    { limit: 100, actor: actorFilter || undefined },
    true,
  );

  const actors = data?.actors ? Object.entries(data.actors) : [];

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-lg border-l border-gray-200 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
        <h2 className="text-sm font-semibold text-gray-800">Activity Feed</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-lg leading-none"
        >
          &times;
        </button>
      </div>

      {/* Actor filter */}
      <div className="px-4 py-2 border-b bg-gray-50">
        <select
          value={actorFilter}
          onChange={(e) => setActorFilter(e.target.value)}
          className="w-full text-sm border border-gray-300 rounded px-2 py-1 bg-white"
        >
          <option value="">All actors</option>
          {actors.map(([name, type]) => (
            <option key={name} value={name}>
              {name} ({type})
            </option>
          ))}
        </select>
      </div>

      {/* Entries */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {isLoading && (
          <div className="text-sm text-gray-400 text-center py-8">Loading activity...</div>
        )}

        {data && data.entries.length === 0 && (
          <div className="text-sm text-gray-400 text-center py-8">
            No activity recorded yet.
          </div>
        )}

        {data?.entries.map((entry, i) => (
          <TraceRow key={`${entry.timestamp}-${entry.target}-${i}`} entry={entry} />
        ))}
      </div>
    </div>
  );
}
