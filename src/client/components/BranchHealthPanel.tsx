/**
 * Branch Health Panel
 *
 * Shows health indicators for each branch:
 *  - Commits-behind indicator
 *  - Last commit date (relative age)
 *  - Unique spec count (specs not on main)
 *  - Conflict risk badge
 */

import React from 'react';
import type { BranchHealth } from '../../server/api/branch-health.js';

interface BranchHealthPanelProps {
  health: BranchHealth[];
  onClose: () => void;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function CommitsBehindBadge({ count }: { count: number }) {
  if (count === 0) {
    return (
      <span className="text-xs px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">
        up to date
      </span>
    );
  }
  const color =
    count >= 20
      ? 'bg-red-50 text-red-700 border-red-200'
      : count >= 5
        ? 'bg-orange-50 text-orange-700 border-orange-200'
        : 'bg-yellow-50 text-yellow-700 border-yellow-200';
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded border ${color}`}>
      {count} behind
    </span>
  );
}

function RowItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-gray-400 w-24 shrink-0">{label}</span>
      {children}
    </div>
  );
}

export function BranchHealthPanel({ health, onClose }: BranchHealthPanelProps) {
  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-xl border-l border-gray-200 flex flex-col z-40">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-900">Branch Health</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-lg leading-none"
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div className="overflow-y-auto flex-1 p-4 space-y-4">
        {health.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">No branch data available.</p>
        )}

        {health.map((h) => (
          <div
            key={h.branch}
            className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2"
          >
            {/* Branch name */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-gray-800 truncate">{h.branch}</span>
              {h.conflictRisk && (
                <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
                  conflict risk
                </span>
              )}
            </div>

            {/* Indicators */}
            <div className="space-y-1.5">
              <RowItem label="Commits behind">
                <CommitsBehindBadge count={h.commitsBehind} />
              </RowItem>

              <RowItem label="Last commit">
                <span className="text-xs text-gray-600">{formatDate(h.lastCommitDate)}</span>
              </RowItem>

              <RowItem label="Unique specs">
                {h.uniqueSpecs.length === 0 ? (
                  <span className="text-xs text-gray-400">none</span>
                ) : (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {h.uniqueSpecs.length} spec{h.uniqueSpecs.length !== 1 ? 's' : ''}
                  </span>
                )}
              </RowItem>

              {/* List unique spec names */}
              {h.uniqueSpecs.length > 0 && (
                <ul className="ml-24 space-y-0.5">
                  {h.uniqueSpecs.map((spec) => (
                    <li key={spec} className="text-xs text-gray-500 truncate">
                      {spec}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
