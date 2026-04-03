/**
 * Workflow Launch Panel
 *
 * Unified modal for launching GLaDOS workflows. Shown after a phase
 * transition completes or when the user clicks a workflow button.
 * Collects per-run parameters and shows editable preamble/postamble
 * boilerplate from the workflow config.
 */

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchWorkflowConfig } from '../api.js';
import type { WorkflowConfig } from '../api.js';

export interface LaunchResult {
  contextHints: Record<string, string>;
}

interface WorkflowLaunchPanelProps {
  cardId: string;
  cardTitle: string;
  workflowType: string;
  specDir?: string;
  onLaunch: (result: LaunchResult) => void;
  onCancel: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  plan: 'Plan Feature',
  spec: 'Spec Feature',
  implement: 'Implement Feature',
  verify: 'Verify Feature',
};

export function WorkflowLaunchPanel({
  cardId,
  cardTitle,
  workflowType,
  specDir,
  onLaunch,
  onCancel,
}: WorkflowLaunchPanelProps) {
  const { data: configs } = useQuery({
    queryKey: ['workflow-config'],
    queryFn: fetchWorkflowConfig,
    staleTime: 60_000,
  });

  const typeConfig: WorkflowConfig | undefined = configs?.[workflowType];

  // Track param values — initialize from defaults and card context
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  // Preamble/postamble — editable per-run, initialized from config
  const [preamble, setPreamble] = useState('');
  const [postamble, setPostamble] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);

  // Initialize when config loads
  useEffect(() => {
    if (!typeConfig) return;
    const defaults: Record<string, string> = {};
    for (const param of typeConfig.params ?? []) {
      if (param.key === 'featureName') {
        defaults[param.key] = cardTitle || param.default || '';
      } else {
        defaults[param.key] = param.default || '';
      }
    }
    setParamValues(defaults);
    setPreamble(typeConfig.preamble ?? '');
    setPostamble(typeConfig.postamble ?? '');
  }, [typeConfig, cardTitle]);

  const handleParamChange = (key: string, value: string) => {
    setParamValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleLaunch = () => {
    const hints: Record<string, string> = { ...paramValues };
    // Pass preamble/postamble overrides if they differ from config defaults
    if (preamble !== (typeConfig?.preamble ?? '')) {
      hints['_preamble'] = preamble;
    }
    if (postamble !== (typeConfig?.postamble ?? '')) {
      hints['_postamble'] = postamble;
    }
    onLaunch({ contextHints: hints });
  };

  const params = typeConfig?.params ?? [];
  const hasPreamble = preamble.length > 0;
  const hasPostamble = postamble.length > 0;
  const hasInstructions = hasPreamble || hasPostamble;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
          {TYPE_LABELS[workflowType] ?? workflowType}
        </h2>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4 truncate" title={cardId}>
          {cardTitle || cardId}
        </p>

        {/* Parameters */}
        {params.length > 0 && (
          <div className="mb-4 space-y-3">
            {params.map((param) => (
              <div key={param.key}>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-1">
                  {param.label}
                </label>
                {param.type === 'select' && param.options ? (
                  <select
                    value={paramValues[param.key] ?? ''}
                    onChange={(e) => handleParamChange(param.key, e.target.value)}
                    className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 dark:bg-gray-700 dark:text-gray-200"
                  >
                    {param.options.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={paramValues[param.key] ?? ''}
                    onChange={(e) => handleParamChange(param.key, e.target.value)}
                    placeholder={param.label}
                    className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 dark:bg-gray-700 dark:text-gray-200"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Preamble / Postamble (collapsible) */}
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setShowInstructions(!showInstructions)}
            className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <span>{showInstructions ? '\u25BC' : '\u25B6'}</span>
            Instructions
            {!showInstructions && hasInstructions && (
              <span className="text-[10px] font-normal normal-case text-gray-400">(configured)</span>
            )}
            {!showInstructions && !hasInstructions && (
              <span className="text-[10px] font-normal normal-case text-gray-400">(none)</span>
            )}
          </button>
          {showInstructions && (
            <div className="mt-2 space-y-3">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                  Preamble <span className="text-gray-400">(prepended to prompt)</span>
                </label>
                <textarea
                  value={preamble}
                  onChange={(e) => setPreamble(e.target.value)}
                  rows={3}
                  className="w-full text-xs font-mono border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 dark:bg-gray-700 dark:text-gray-200 resize-y"
                  placeholder="e.g., Run all commands in Docker..."
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                  Postamble <span className="text-gray-400">(appended after workflow)</span>
                </label>
                <textarea
                  value={postamble}
                  onChange={(e) => setPostamble(e.target.value)}
                  rows={3}
                  className="w-full text-xs font-mono border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 dark:bg-gray-700 dark:text-gray-200 resize-y"
                  placeholder="e.g., Commit changes when done..."
                />
              </div>
            </div>
          )}
        </div>

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
            onClick={handleLaunch}
            className="px-4 py-2 text-sm rounded bg-violet-600 text-white hover:bg-violet-700 transition-colors"
          >
            Run
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
