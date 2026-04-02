/**
 * Workflow Panel Component
 *
 * Triggers and monitors GLaDOS workflow runs (plan, spec, implement, verify).
 * Supports interactive mode with chat-style prompts and autonomous mode.
 * Shows a WorkflowLaunchPanel before starting a new workflow.
 */

import React, { useRef, useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  startWorkflow,
  fetchWorkflowRun,
  fetchWorkflowOutput,
  cancelWorkflow,
  listActiveWorkflows,
  sendWorkflowInput,
} from '../api.js';
import type { WorkflowRun, WorkflowMode } from '../api.js';
import { WorkflowLaunchPanel } from './WorkflowLaunchPanel.js';

interface WorkflowPanelProps {
  cardId: string;
  cardTitle?: string;
  specDir?: string;
  phase: string;
  branch?: string;
}

/** Map card phase to available workflow action. */
function getAvailableAction(phase: string): { type: string; label: string } | null {
  switch (phase) {
    case 'unclaimed':
    case 'planning':
      return { type: 'plan', label: 'Run Plan' };
    case 'speccing':
      return { type: 'implement', label: 'Run Implement' };
    case 'implementing':
      return { type: 'verify', label: 'Run Verify' };
    default:
      return null;
  }
}

/** Secondary action for planning phase. */
function getSecondaryAction(phase: string): { type: string; label: string } | null {
  if (phase === 'planning') {
    return { type: 'spec', label: 'Run Spec' };
  }
  return null;
}

const STATE_BADGES: Record<WorkflowRun['state'], { bg: string; text: string }> = {
  queued: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-300' },
  running: { bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' },
  waiting_for_input: { bg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300' },
  done: { bg: 'bg-green-50 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' },
  error: { bg: 'bg-red-50 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' },
  cancelled: { bg: 'bg-yellow-50 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300' },
};

// ---------------------------------------------------------------------------
// Chat-style workflow output
// ---------------------------------------------------------------------------

function WorkflowChat({ runId, run }: { runId: string; run: WorkflowRun | null }) {
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputText, setInputText] = useState('');

  const { data } = useQuery({
    queryKey: ['workflow-output', runId],
    queryFn: () => fetchWorkflowOutput(runId),
    refetchInterval: 2000,
  });

  const inputMutation = useMutation({
    mutationFn: (text: string) => sendWorkflowInput(runId, text),
    onSuccess: () => setInputText(''),
  });

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [data?.lines, run?.pendingPrompt]);

  // Focus the input when a prompt appears
  useEffect(() => {
    if (run?.state === 'waiting_for_input') {
      inputRef.current?.focus();
    }
  }, [run?.state]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim() && !inputMutation.isPending) {
      inputMutation.mutate(inputText.trim());
    }
  };

  const lines = data?.lines ?? [];
  const isWaiting = run?.state === 'waiting_for_input';
  const isAutonomousPhase = run?.autonomousPhase;

  return (
    <div className="space-y-2">
      {/* Output area */}
      <div
        ref={outputRef}
        className="bg-gray-900 text-gray-300 font-mono text-xs p-3 rounded-lg max-h-72 overflow-y-auto space-y-0.5"
      >
        {lines.length === 0 && (
          <div className="text-gray-500">Waiting for output...</div>
        )}
        {lines.map((line, i) => {
          // User response lines (echoed with "> " prefix)
          if (line.startsWith('> ')) {
            return (
              <div key={i} className="flex justify-end">
                <span className="bg-violet-600 text-white px-2 py-0.5 rounded-md max-w-[80%]">
                  {line.slice(2)}
                </span>
              </div>
            );
          }
          // Prompt lines
          if (line.startsWith('[prompt] ')) {
            return (
              <div key={i} className="flex justify-start">
                <span className="bg-gray-700 text-amber-300 px-2 py-0.5 rounded-md max-w-[80%]">
                  {line.slice(9)}
                </span>
              </div>
            );
          }
          // Auto-answer lines
          if (line.startsWith('[auto] ')) {
            return (
              <div key={i} className="flex justify-start">
                <span className="bg-gray-700 text-gray-400 px-2 py-0.5 rounded-md max-w-[80%] italic">
                  {line.slice(7)}
                </span>
              </div>
            );
          }
          // Phase transition marker
          if (line.startsWith('[Entering autonomous')) {
            return (
              <div key={i} className="text-center text-gray-500 text-[10px] py-1 border-t border-gray-700 mt-1">
                {line.replace(/[[\]]/g, '')}
              </div>
            );
          }
          // Normal output
          return (
            <div key={i} className="text-green-400 whitespace-pre-wrap">{line}</div>
          );
        })}

        {/* Pending prompt bubble */}
        {isWaiting && run.pendingPrompt && (
          <div className="flex justify-start mt-2">
            <span className="bg-amber-600/20 text-amber-300 px-3 py-1.5 rounded-lg border border-amber-600/30">
              {run.pendingPrompt}
            </span>
          </div>
        )}
      </div>

      {/* Autonomous phase indicator */}
      {isAutonomousPhase && !isWaiting && run?.state === 'running' && (
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          Running autonomously...
        </div>
      )}

      {/* Input field (shown when waiting for input) */}
      {isWaiting && (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type your response..."
            disabled={inputMutation.isPending}
            className="flex-1 text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 dark:bg-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || inputMutation.isPending}
            className="text-sm px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {inputMutation.isPending ? '...' : 'Send'}
          </button>
        </form>
      )}

      {inputMutation.isError && (
        <p className="text-xs text-red-500">
          {inputMutation.error instanceof Error ? inputMutation.error.message : 'Failed to send input'}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Active run display
// ---------------------------------------------------------------------------

function ActiveRun({
  run,
  onCancelled,
}: {
  run: WorkflowRun;
  onCancelled: () => void;
}) {
  const queryClient = useQueryClient();
  const stateBadge = STATE_BADGES[run.state];

  const cancelMutation = useMutation({
    mutationFn: () => cancelWorkflow(run.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workflow-run'] });
      void queryClient.invalidateQueries({ queryKey: ['workflow-output'] });
      onCancelled();
    },
  });

  const isActive = run.state === 'running' || run.state === 'queued' || run.state === 'waiting_for_input';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stateBadge.bg} ${stateBadge.text}`}>
            {run.state === 'waiting_for_input' ? 'waiting' : run.state}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{run.type}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">({run.mode})</span>
          {(run.state === 'running' || run.state === 'queued') && (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          )}
          {run.state === 'waiting_for_input' && (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          )}
        </div>
        {isActive && (
          <button
            type="button"
            onClick={() => cancelMutation.mutate()}
            disabled={cancelMutation.isPending}
            className="text-xs px-2 py-1 rounded border border-red-200 dark:border-red-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
          >
            {cancelMutation.isPending ? 'Cancelling...' : 'Cancel'}
          </button>
        )}
      </div>

      <WorkflowChat runId={run.id} run={run} />

      {cancelMutation.isError && (
        <p className="text-xs text-red-500">
          {cancelMutation.error instanceof Error ? cancelMutation.error.message : 'Cancel failed'}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Completed run history item
// ---------------------------------------------------------------------------

function CompletedRunItem({ run }: { run: WorkflowRun }) {
  const stateBadge = STATE_BADGES[run.state];
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded p-2 space-y-1">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stateBadge.bg} ${stateBadge.text}`}>
            {run.state}
          </span>
          <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">{run.type}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">
            {run.finishedAt ? new Date(run.finishedAt).toLocaleString(undefined, {
              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
            }) : ''}
          </span>
          <span className="text-xs text-gray-400">{expanded ? '\u25B2' : '\u25BC'}</span>
        </div>
      </button>

      {expanded && run.outputTail.length > 0 && (
        <div className="bg-gray-900 text-green-400 font-mono text-xs p-2 rounded max-h-32 overflow-y-auto mt-1">
          {run.outputTail.map((line, i) => (
            <div key={i} className="whitespace-pre-wrap">{line}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main WorkflowPanel
// ---------------------------------------------------------------------------

export function WorkflowPanel({ cardId, cardTitle, specDir, phase, branch }: WorkflowPanelProps) {
  const queryClient = useQueryClient();
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [launchIntent, setLaunchIntent] = useState<{ type: string } | null>(null);

  const primaryAction = getAvailableAction(phase);
  const secondaryAction = getSecondaryAction(phase);

  // Poll the active run
  const { data: activeRun } = useQuery({
    queryKey: ['workflow-run', activeRunId],
    queryFn: () => (activeRunId ? fetchWorkflowRun(activeRunId) : null),
    enabled: !!activeRunId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && (data.state === 'running' || data.state === 'queued' || data.state === 'waiting_for_input')) return 2000;
      return false;
    },
  });

  // List all active workflows for this card
  const { data: allActive } = useQuery({
    queryKey: ['active-workflows'],
    queryFn: listActiveWorkflows,
    refetchInterval: 10_000,
  });

  // Find if there is already a running workflow for this card
  const cardActiveRun = allActive?.runs.find(
    (r) => r.cardId === cardId && (r.state === 'running' || r.state === 'queued' || r.state === 'waiting_for_input'),
  );

  // Use the polled active run if available, otherwise the one from the list
  const displayRun = activeRun ?? cardActiveRun ?? null;
  const isRunActive = displayRun && (
    displayRun.state === 'running' ||
    displayRun.state === 'queued' ||
    displayRun.state === 'waiting_for_input'
  );

  // Set activeRunId when we discover one from the list
  useEffect(() => {
    if (cardActiveRun && !activeRunId) {
      setActiveRunId(cardActiveRun.id);
    }
  }, [cardActiveRun, activeRunId]);

  // Completed runs
  const completedRuns = allActive?.runs.filter(
    (r) => r.cardId === cardId && r.state !== 'running' && r.state !== 'queued' && r.state !== 'waiting_for_input',
  ) ?? [];

  const startMutation = useMutation({
    mutationFn: ({ type, mode }: { type: string; mode: WorkflowMode }) =>
      startWorkflow(cardId, type, specDir, branch, mode),
    onSuccess: (data) => {
      setActiveRunId(data.runId);
      setLaunchIntent(null);
      void queryClient.invalidateQueries({ queryKey: ['active-workflows'] });
    },
  });

  const handleLaunch = (mode: WorkflowMode) => {
    if (launchIntent) {
      startMutation.mutate({ type: launchIntent.type, mode });
    }
  };

  return (
    <div className="px-6 py-4 border-b dark:border-gray-700 space-y-3">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">GLaDOS Workflows</h3>

      {/* Action buttons */}
      {!isRunActive && (primaryAction || secondaryAction) && (
        <div className="flex items-center gap-2">
          {primaryAction && (
            <button
              type="button"
              onClick={() => setLaunchIntent({ type: primaryAction.type })}
              disabled={startMutation.isPending}
              className="text-xs px-3 py-1.5 rounded bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {primaryAction.label}
            </button>
          )}
          {secondaryAction && (
            <button
              type="button"
              onClick={() => setLaunchIntent({ type: secondaryAction.type })}
              disabled={startMutation.isPending}
              className="text-xs px-3 py-1.5 rounded bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/50 border border-violet-200 dark:border-violet-700 disabled:opacity-50"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}

      {startMutation.isError && (
        <p className="text-xs text-red-500">
          {startMutation.error instanceof Error ? startMutation.error.message : 'Failed to start workflow'}
        </p>
      )}

      {/* Active run display */}
      {displayRun && isRunActive && (
        <ActiveRun
          run={displayRun}
          onCancelled={() => {
            setActiveRunId(null);
            void queryClient.invalidateQueries({ queryKey: ['active-workflows'] });
          }}
        />
      )}

      {/* Recently completed active run */}
      {displayRun && !isRunActive && activeRunId && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATE_BADGES[displayRun.state].bg} ${STATE_BADGES[displayRun.state].text}`}>
              {displayRun.state}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{displayRun.type} completed</span>
          </div>
          {displayRun.outputTail.length > 0 && (
            <div className="bg-gray-900 text-green-400 font-mono text-xs p-2 rounded max-h-32 overflow-y-auto">
              {displayRun.outputTail.map((line, i) => (
                <div key={i} className="whitespace-pre-wrap">{line}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* No actions available */}
      {!primaryAction && !secondaryAction && !isRunActive && (
        <p className="text-sm text-gray-400 dark:text-gray-500 py-1">No workflow actions available for the current phase.</p>
      )}

      {/* Workflow history */}
      {completedRuns.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">History</h4>
          {completedRuns.map((run) => (
            <CompletedRunItem key={run.id} run={run} />
          ))}
        </div>
      )}

      {/* Launch panel modal */}
      {launchIntent && (
        <WorkflowLaunchPanel
          cardId={cardId}
          cardTitle={cardTitle ?? cardId}
          workflowType={launchIntent.type}
          specDir={specDir}
          onLaunch={handleLaunch}
          onCancel={() => setLaunchIntent(null)}
        />
      )}
    </div>
  );
}
