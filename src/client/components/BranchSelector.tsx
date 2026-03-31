/**
 * Branch Selector
 *
 * Dropdown to select which branch the board reads from.
 */

import React from 'react';
import { useBranches } from '../hooks/use-board.js';

interface BranchSelectorProps {
  selectedBranch?: string;
  onBranchChange: (branch: string) => void;
}

export function BranchSelector({ selectedBranch, onBranchChange }: BranchSelectorProps) {
  const { data, isLoading } = useBranches();

  if (isLoading) {
    return (
      <select disabled className="text-sm border rounded px-2 py-1 bg-gray-100 text-gray-400">
        <option>Loading...</option>
      </select>
    );
  }

  const current = selectedBranch ?? data?.current ?? 'main';

  return (
    <select
      value={current}
      onChange={(e) => onBranchChange(e.target.value)}
      className="text-sm border border-gray-300 rounded px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {data?.branches.map((branch) => (
        <option key={branch} value={branch}>
          {branch}
        </option>
      ))}
    </select>
  );
}
