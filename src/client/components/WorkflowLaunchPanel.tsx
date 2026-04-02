/**
 * Workflow Launch Panel
 *
 * Unified modal for launching GLaDOS workflows. Shown after a phase
 * transition completes or when the user clicks a workflow button.
 * Lets the user choose autonomous vs interactive mode and configure parameters.
 */

import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchWorkflowConfig } from '../api.js';
import type { WorkflowMode, WorkflowConfig } from '../api.js';

interface WorkflowLaunchPanelProps {
  cardId: string;
  cardTitle: string;
  workflowType: string;
  specDir?: string;
  onLaunch: (mode: WorkflowMode) => void;
  onCancel: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  plan: 'Plan Feature',
  spec: 'Spec Feature',
  implement: 'Implement Feature',
  verify: 'Verify Feature',
};

const MODE_DESCRIPTIONS: Record<WorkflowMode, string> = {
  interactive: 'Claude will ask questions and wait for your answers in a chat-style UI.',
  autonomous: 'Claude will run to completion using configured defaults. No input needed.',
};

export function WorkflowLaunchPanel({
  cardId,
  cardTitle,
  workflowType,
  onLaunch,
  onCancel,
}: WorkflowLaunchPanelProps) {
  const { data: configs } = useQuery({
    queryKey: ['workflow-config'],
    queryFn: fetchWorkflowConfig,
    staleTime: 60_000,
  });

  const typeConfig: WorkflowConfig | undefined = configs?.[workflowType];
  const defaultMode = typeConfig?.defaultMode ?? 'interactive';
  const [mode, setMode] = useState<WorkflowMode>(defaultMode);

  return ReactDOM.createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        {/* Header */}
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
          Launch Workflow
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
          {TYPE_LABELS[workflowType] ?? workflowType}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4 truncate" title={cardId}>
          {cardTitle || cardId}
        </p>

        {/* Mode Toggle */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-2 block">
            Execution Mode
          </label>
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
            <button
              type="button"
              onClick={() => setMode('interactive')}
              className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                mode === 'interactive'
                  ? 'bg-violet-600 text-white'
                  : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
            >
              Interactive
            </button>
            <button
              type="button"
              onClick={() => setMode('autonomous')}
              className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                mode === 'autonomous'
                  ? 'bg-violet-600 text-white'
                  : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
            >
              Autonomous
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {MODE_DESCRIPTIONS[mode]}
          </p>
        </div>

        {/* Parameters (if config defines them) */}
        {typeConfig?.params && typeConfig.params.length > 0 && (
          <div className="mb-4 space-y-3">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide block">
              Parameters
            </label>
            {typeConfig.params.map((param) => (
              <div key={param.key}>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                  {param.label}
                </label>
                {param.type === 'select' && param.options ? (
                  <select
                    defaultValue={param.default}
                    className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 dark:bg-gray-700 dark:text-gray-200"
                  >
                    {param.options.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    defaultValue={param.default}
                    placeholder={param.label}
                    className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 dark:bg-gray-700 dark:text-gray-200"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onLaunch(mode)}
            className="px-4 py-2 text-sm rounded bg-violet-600 text-white hover:bg-violet-700 transition-colors"
          >
            Run {TYPE_LABELS[workflowType] ?? workflowType}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
