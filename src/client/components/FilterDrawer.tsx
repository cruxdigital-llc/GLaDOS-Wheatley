/**
 * FilterDrawer Component
 *
 * Collapsible filter drawer that slides down below the header toolbar.
 * Contains status pills, assigned-to input, priority pills, labels checkbox,
 * quick presets, and saved presets dropdown.
 */

import React, { useState } from 'react';
import type { BoardPhase } from '../../shared/grammar/types.js';
import { phaseDisplayName } from '../../shared/display-names.js';

interface CompoundFilter {
  phases: BoardPhase[];
  claimant: string;
  priority: string;
  hasLabels: boolean;
}

interface SavedPreset {
  name: string;
  filter: CompoundFilter;
}

interface FilterDrawerProps {
  isOpen: boolean;
  filter: CompoundFilter;
  onFilterChange: (filter: CompoundFilter) => void;
  currentUser: string;
  presets: SavedPreset[];
  onPresetsChange: (presets: SavedPreset[]) => void;
  onClear: () => void;
  isFilterEmpty: boolean;
}

const ALL_PHASES: BoardPhase[] = ['unclaimed', 'planning', 'speccing', 'implementing', 'verifying', 'done'];
const PRIORITIES = ['', 'P0', 'P1', 'P2', 'P3'] as const;
const PRIORITY_LABELS: Record<string, string> = { '': 'Any', P0: 'P0', P1: 'P1', P2: 'P2', P3: 'P3' };
const PRIORITY_PILL_COLORS: Record<string, string> = {
  '': '',
  P0: 'bg-red-500 text-white dark:bg-red-600',
  P1: 'bg-orange-400 text-white dark:bg-orange-500',
  P2: 'bg-yellow-400 text-gray-900 dark:bg-yellow-500',
  P3: 'bg-gray-300 text-gray-700 dark:bg-gray-600 dark:text-gray-200',
};

function defaultFilter(): CompoundFilter {
  return { phases: [], claimant: '', priority: '', hasLabels: false };
}

function savePresetsToStorage(presets: SavedPreset[]): void {
  localStorage.setItem('wheatley_saved_filters', JSON.stringify(presets.slice(0, 10)));
}

export function FilterDrawer({
  isOpen,
  filter,
  onFilterChange,
  currentUser,
  presets,
  onPresetsChange,
  onClear,
  isFilterEmpty,
}: FilterDrawerProps) {
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [presetName, setPresetName] = useState('');

  const togglePhase = (phase: BoardPhase) => {
    const phases = filter.phases.includes(phase)
      ? filter.phases.filter((p) => p !== phase)
      : [...filter.phases, phase];
    onFilterChange({ ...filter, phases });
  };

  return (
    <div
      className="overflow-hidden transition-all duration-300 ease-in-out"
      style={{ maxHeight: isOpen ? '400px' : '0px' }}
    >
      <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-4 py-3 space-y-3">
        {/* Row 1: Status pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status:</span>
          {ALL_PHASES.map((phase) => {
            const active = filter.phases.includes(phase);
            return (
              <button
                key={phase}
                type="button"
                onClick={() => togglePhase(phase)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  active
                    ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-600 font-medium'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600'
                }`}
              >
                {phaseDisplayName(phase)}
              </button>
            );
          })}
        </div>

        {/* Row 2: Assigned to + Priority pills + Has labels */}
        <div className="flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <span className="font-medium uppercase tracking-wide">Assigned to:</span>
            <input
              type="text"
              value={filter.claimant}
              onChange={(e) => onFilterChange({ ...filter, claimant: e.target.value })}
              placeholder="name..."
              className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 w-28 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </label>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Priority:</span>
            {PRIORITIES.map((p) => {
              const active = filter.priority === p;
              const colorClass = active && p !== '' ? PRIORITY_PILL_COLORS[p] : '';
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => onFilterChange({ ...filter, priority: p })}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    active
                      ? colorClass || 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-600 font-medium'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600'
                  }`}
                >
                  {PRIORITY_LABELS[p]}
                </button>
              );
            })}
          </div>

          <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={filter.hasLabels}
              onChange={(e) => onFilterChange({ ...filter, hasLabels: e.target.checked })}
              className="rounded"
            />
            <span className="font-medium">Has labels</span>
          </label>
        </div>

        {/* Row 3: Quick presets + Clear + Saved presets */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Quick:</span>
          <button
            type="button"
            onClick={onClear}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              isFilterEmpty
                ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-600 font-medium'
                : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => onFilterChange({ ...defaultFilter(), claimant: currentUser })}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              filter.claimant === currentUser && currentUser && filter.phases.length === 0
                ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-600 font-medium'
                : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600'
            }`}
          >
            Assigned to me
          </button>
          <button
            type="button"
            onClick={() => onFilterChange({ ...defaultFilter(), phases: ['unclaimed'] })}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              filter.phases.length === 1 && filter.phases[0] === 'unclaimed' && !filter.claimant
                ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-600 font-medium'
                : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600'
            }`}
          >
            Unassigned
          </button>

          {!isFilterEmpty && (
            <button
              type="button"
              onClick={onClear}
              className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 underline ml-1"
            >
              Clear
            </button>
          )}

          <div className="border-l border-gray-200 dark:border-gray-600 h-5 mx-1" />

          {/* Saved presets dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowPresetMenu((v) => !v)}
              className="text-xs px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              Presets
            </button>
            {showPresetMenu && (
              <div className="absolute top-full left-0 mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-30 py-1">
                <form
                  className="px-3 py-2 border-b dark:border-gray-700 flex gap-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const trimmed = presetName.trim();
                    if (!trimmed) return;
                    const next = [...presets.filter((p) => p.name !== trimmed), { name: trimmed, filter: { ...filter } }].slice(-10);
                    onPresetsChange(next);
                    savePresetsToStorage(next);
                    setPresetName('');
                  }}
                >
                  <input
                    type="text"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="Preset name..."
                    className="flex-1 text-xs border border-gray-300 dark:border-gray-600 rounded px-1.5 py-0.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                  <button
                    type="submit"
                    className="text-xs px-2 py-0.5 rounded bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Save
                  </button>
                </form>
                {presets.length === 0 && (
                  <div className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">No saved presets</div>
                )}
                {presets.map((p) => (
                  <div key={p.name} className="flex items-center justify-between px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onFilterChange({ ...p.filter });
                        setShowPresetMenu(false);
                      }}
                      className="text-xs text-gray-700 dark:text-gray-300 flex-1 text-left truncate"
                    >
                      {p.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next = presets.filter((x) => x.name !== p.name);
                        onPresetsChange(next);
                        savePresetsToStorage(next);
                      }}
                      className="text-xs text-red-400 hover:text-red-600 dark:hover:text-red-300"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
