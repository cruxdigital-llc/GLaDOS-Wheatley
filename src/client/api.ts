/**
 * API Client
 *
 * Typed HTTP client for the Wheatley backend.
 */

import type { BoardState, ClaimEntry, TraceEntry } from '../shared/grammar/types.js';
import type { ConsolidatedBoardState } from '../shared/consolidation/merge.js';
import type { BranchHealth } from '../server/api/branch-health.js';

const API_BASE = '/api';

export interface BranchesResponse {
  branches: string[];
  current: string;
}

export interface CardDetailResponse {
  card: {
    id: string;
    title: string;
    phase: string;
    source: string;
    specEntry?: {
      dirName: string;
      files: string[];
    };
    metadata?: {
      labels?: string[];
      priority?: string | null;
      due?: string | null;
    };
  };
  specContents?: Record<string, string>;
}

/** Thrown when a claim attempt returns 409 (item already claimed). */
export class ClaimConflictError extends Error {
  claimedBy: string;
  constructor(claimedBy: string) {
    super(`Already claimed by ${claimedBy}`);
    this.name = 'ClaimConflictError';
    this.claimedBy = claimedBy;
  }
}

/**
 * Read the stored JWT token (cloud mode).
 * Returns null if no token is stored or localStorage is unavailable.
 */
function getStoredToken(): string | null {
  try {
    return typeof window !== 'undefined'
      ? localStorage.getItem('wheatley_token')
      : null;
  } catch {
    // localStorage may be disabled (private browsing, security policy)
    return null;
  }
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  // Attach JWT Bearer header if a token is available (cloud mode)
  const token = getStoredToken();
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    // Token expired or invalid — clear and redirect to login
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('wheatley_token');
        window.location.href = '/login';
      }
    } catch {
      // localStorage unavailable — nothing to clear
    }
    throw new Error('Authentication required');
  }

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchBoard(branch?: string): Promise<BoardState> {
  const params = branch ? `?branch=${encodeURIComponent(branch)}` : '';
  return fetchJson<BoardState>(`${API_BASE}/board${params}`);
}

export interface ConformanceReport {
  conforming: boolean;
  violations: Array<{
    file: string;
    severity: 'error' | 'warning';
    message: string;
  }>;
  summary: {
    filesChecked: number;
    errors: number;
    warnings: number;
  };
}

export async function fetchConformance(branch?: string): Promise<ConformanceReport> {
  const params = branch ? `?branch=${encodeURIComponent(branch)}` : '';
  return fetchJson<ConformanceReport>(`${API_BASE}/conformance${params}`);
}

export interface AutoFixResult {
  fixed: number;
  actions: string[];
  remaining: ConformanceReport;
}

export async function fixConformance(branch?: string): Promise<AutoFixResult> {
  return fetchJson<AutoFixResult>(`${API_BASE}/conformance/fix`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ branch }),
  });
}

export async function fetchCardDetail(
  id: string,
  branch?: string,
): Promise<CardDetailResponse> {
  const params = branch ? `?branch=${encodeURIComponent(branch)}` : '';
  return fetchJson<CardDetailResponse>(
    `${API_BASE}/board/card/${encodeURIComponent(id)}${params}`,
  );
}

export async function fetchBranches(): Promise<BranchesResponse> {
  return fetchJson<BranchesResponse>(`${API_BASE}/branches`);
}

export async function claimItem(itemId: string, claimant: string): Promise<ClaimEntry> {
  const response = await fetch(`${API_BASE}/claims`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId, claimant }),
  });

  if (response.status === 409) {
    let claimedBy = 'someone else';
    try {
      const body = (await response.json()) as { claimedBy?: string; claimant?: string };
      claimedBy = body.claimedBy ?? body.claimant ?? claimedBy;
    } catch {
      // ignore parse errors
    }
    throw new ClaimConflictError(claimedBy);
  }

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<ClaimEntry>;
}

export async function releaseItem(itemId: string, claimant?: string): Promise<ClaimEntry> {
  const params = claimant ? `?claimant=${encodeURIComponent(claimant)}` : '';
  return fetchJson<ClaimEntry>(`${API_BASE}/claims/${encodeURIComponent(itemId)}${params}`, {
    method: 'DELETE',
  });
}

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

export interface TransitionRequest {
  itemId: string;
  from: string;
  to: string;
  branch?: string;
  existingSpecDir?: string;
}

export interface TransitionResult {
  workflowSuggestion?: {
    type: string;
    cardId: string;
  };
}

export async function executeTransition(
  itemId: string,
  from: string,
  to: string,
  branch?: string,
  existingSpecDir?: string,
): Promise<TransitionResult> {
  const body: TransitionRequest = { itemId, from, to };
  if (branch) body.branch = branch;
  if (existingSpecDir) body.existingSpecDir = existingSpecDir;

  const response = await fetch(`${API_BASE}/transitions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let message = `API error: ${response.status} ${response.statusText}`;
    try {
      const err = (await response.json()) as { message?: string };
      if (err.message) message = err.message;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  try {
    return (await response.json()) as TransitionResult;
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Consolidated board
// ---------------------------------------------------------------------------

export interface ConsolidatedBoardQuery {
  include?: string;
  exclude?: string;
  prefixes?: string;
}

export async function fetchConsolidatedBoard(
  query?: ConsolidatedBoardQuery,
): Promise<ConsolidatedBoardState> {
  const params = new URLSearchParams();
  if (query?.include) params.set('include', query.include);
  if (query?.exclude) params.set('exclude', query.exclude);
  if (query?.prefixes) params.set('prefixes', query.prefixes);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return fetchJson<ConsolidatedBoardState>(`${API_BASE}/board/consolidated${qs}`);
}

// ---------------------------------------------------------------------------
// Branch health
// ---------------------------------------------------------------------------

export interface BranchHealthResponse {
  health: BranchHealth[];
}

export async function fetchBranchHealth(base?: string): Promise<BranchHealthResponse> {
  const params = base ? `?base=${encodeURIComponent(base)}` : '';
  return fetchJson<BranchHealthResponse>(`${API_BASE}/branches/health${params}`);
}

// ---------------------------------------------------------------------------
// Workflow status
// ---------------------------------------------------------------------------

export type WorkflowStatusCode = 'idle' | 'running' | 'done' | 'error';

export interface WorkflowStatusResponse {
  itemId: string;
  status: WorkflowStatusCode;
  action?: string;
  startedAt?: string;
  finishedAt?: string;
}

export async function fetchWorkflowStatus(itemId: string): Promise<WorkflowStatusResponse> {
  return fetchJson<WorkflowStatusResponse>(
    `${API_BASE}/workflow/${encodeURIComponent(itemId)}`,
  );
}

// ---------------------------------------------------------------------------
// Activity feed
// ---------------------------------------------------------------------------

export interface ActivityFeedResponse {
  entries: TraceEntry[];
  actors: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

export interface CreateCardRequest {
  title: string;
  phase?: string;
  section?: string;
  branch?: string;
}

export interface CreateCardResponse {
  id: string;
  title: string;
  phase: string;
  specDir?: string;
}

export async function createCard(input: CreateCardRequest): Promise<CreateCardResponse> {
  return fetchJson<CreateCardResponse>(`${API_BASE}/cards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function updateCardMetadata(
  cardId: string,
  metadata: { labels?: string[]; priority?: string; due?: string },
  branch?: string,
): Promise<{ updated: boolean }> {
  return fetchJson(`${API_BASE}/cards/${encodeURIComponent(cardId)}/metadata`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...metadata, branch }),
  });
}

export async function renameCard(id: string, title: string, branch?: string): Promise<void> {
  await fetchJson(`${API_BASE}/cards/${encodeURIComponent(id)}/title`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, branch }),
  });
}

export async function deleteCard(id: string, branch?: string): Promise<void> {
  const params = branch ? `?branch=${encodeURIComponent(branch)}` : '';
  await fetchJson(`${API_BASE}/cards/${encodeURIComponent(id)}${params}`, {
    method: 'DELETE',
  });
}

export interface ArchiveCardResponse {
  archived: boolean;
  id: string;
  specDir: string;
  specLogEntry: string;
}

export async function archiveCard(id: string, branch?: string): Promise<ArchiveCardResponse> {
  return fetchJson<ArchiveCardResponse>(
    `${API_BASE}/cards/${encodeURIComponent(id)}/archive`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch }),
    },
  );
}

export async function bulkArchive(
  cardIds: string[],
  branch?: string,
): Promise<{ results: Array<{ id: string; success: boolean; specDir?: string; error?: string }> }> {
  return fetchJson(`${API_BASE}/bulk/archive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cardIds, branch }),
  });
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export interface CommentEntry {
  author: string;
  timestamp: string;
  body: string;
}

export async function fetchComments(
  specDir: string,
  branch?: string,
): Promise<{ comments: CommentEntry[] }> {
  const params = branch ? `?branch=${encodeURIComponent(branch)}` : '';
  return fetchJson<{ comments: CommentEntry[] }>(
    `${API_BASE}/specs/${encodeURIComponent(specDir)}/comments${params}`,
  );
}

export async function addComment(
  specDir: string,
  author: string,
  body: string,
  branch?: string,
): Promise<{ added: boolean }> {
  return fetchJson<{ added: boolean }>(
    `${API_BASE}/specs/${encodeURIComponent(specDir)}/comments`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author, body, branch }),
    },
  );
}

// ---------------------------------------------------------------------------
// Specs
// ---------------------------------------------------------------------------

export async function saveSpecFile(
  specDir: string,
  fileName: string,
  content: string,
  branch?: string,
): Promise<{ saved: boolean; path: string }> {
  return fetchJson<{ saved: boolean; path: string }>(
    `${API_BASE}/specs/${encodeURIComponent(specDir)}/${encodeURIComponent(fileName)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, branch }),
    },
  );
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

export async function triggerSync(): Promise<{ synced: boolean }> {
  return fetchJson<{ synced: boolean }>(`${API_BASE}/sync`, { method: 'POST' });
}

// ---------------------------------------------------------------------------
// Git identity
// ---------------------------------------------------------------------------

export interface GitIdentityResponse {
  name: string | null;
  email: string | null;
  source: 'git-config' | 'env';
}

export async function fetchGitIdentity(): Promise<GitIdentityResponse> {
  return fetchJson<GitIdentityResponse>(`${API_BASE}/identity`);
}

// ---------------------------------------------------------------------------
// Repo status
// ---------------------------------------------------------------------------

export interface RepoStatusResponse {
  clean: boolean;
  modified: number;
  untracked: number;
  staged: number;
  conflicted: boolean;
  conflictedFiles: string[];
  worktreeActive: boolean;
  pushOnWrite: boolean;
  unpushedCommits: number;
  gpgWarning?: string;
}

export async function fetchRepoStatus(): Promise<RepoStatusResponse> {
  return fetchJson<RepoStatusResponse>(`${API_BASE}/repo/status`);
}

export async function pushToOrigin(): Promise<{ pushed: boolean; commits: number }> {
  return fetchJson<{ pushed: boolean; commits: number }>(`${API_BASE}/repo/push`, {
    method: 'POST',
  });
}

// ---------------------------------------------------------------------------
// Activity feed
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export interface SearchResult {
  cardId: string;
  title: string;
  phase: string;
  matchType: 'title' | 'spec' | 'comment' | 'claimant';
  matchContext: string;
  score: number;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
}

export async function searchCards(query: string, branch?: string): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query });
  if (branch) params.set('branch', branch);
  return fetchJson<SearchResponse>(`${API_BASE}/search?${params.toString()}`);
}

export async function fetchActivityFeed(
  options?: { limit?: number; actor?: string },
): Promise<ActivityFeedResponse> {
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.actor) params.set('actor', options.actor);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return fetchJson<ActivityFeedResponse>(`${API_BASE}/activity${qs}`);
}

// ---------------------------------------------------------------------------
// Pull Requests / Merge Requests
// ---------------------------------------------------------------------------

export interface PullRequest {
  id: number;
  number: number;
  title: string;
  description: string;
  state: 'open' | 'draft' | 'merged' | 'closed';
  url: string;
  sourceBranch: string;
  targetBranch: string;
  author: string;
  reviewers: { name: string; state: string }[];
  checkStatus: 'passing' | 'failing' | 'pending' | 'unknown';
  createdAt: string;
  updatedAt: string;
  mergedAt?: string;
}

export async function fetchCardPRs(cardId: string): Promise<{ prs: PullRequest[] }> {
  const prs = await fetchJson<PullRequest[]>(
    `${API_BASE}/prs/card/${encodeURIComponent(cardId)}`,
  );
  return { prs };
}

export async function createPR(input: {
  title: string;
  description: string;
  sourceBranch: string;
  targetBranch: string;
  draft?: boolean;
}): Promise<PullRequest> {
  return fetchJson<PullRequest>(`${API_BASE}/prs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function mergePR(prNumber: number, strategy: string): Promise<void> {
  await fetchJson(`${API_BASE}/prs/${prNumber}/merge`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ strategy }),
  });
}

// ---------------------------------------------------------------------------
// Workflow Runs (GLaDOS orchestration)
// ---------------------------------------------------------------------------

export interface WorkflowRun {
  id: string;
  cardId: string;
  type: 'plan' | 'spec' | 'implement' | 'verify';
  state: 'queued' | 'running' | 'done' | 'error' | 'cancelled';
  startedAt: string;
  finishedAt?: string;
  outputTail: string[];
}

export async function startWorkflow(
  cardId: string,
  type: string,
  specDir?: string,
  branch?: string,
  cardTitle?: string,
  contextHints?: Record<string, string>,
): Promise<{ runId: string }> {
  return fetchJson<{ runId: string }>(`${API_BASE}/workflows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cardId, type, specDir, branch, cardTitle, contextHints }),
  });
}

export async function fetchWorkflowRun(runId: string): Promise<WorkflowRun> {
  return fetchJson<WorkflowRun>(
    `${API_BASE}/workflows/${encodeURIComponent(runId)}`,
  );
}

export async function fetchWorkflowOutput(
  runId: string,
  from?: number,
): Promise<{ lines: string[]; total: number }> {
  const params = from !== undefined ? `?from=${from}` : '';
  return fetchJson<{ lines: string[]; total: number }>(
    `${API_BASE}/workflows/${encodeURIComponent(runId)}/output${params}`,
  );
}

export async function cancelWorkflow(runId: string): Promise<void> {
  await fetchJson(`${API_BASE}/workflows/${encodeURIComponent(runId)}`, {
    method: 'DELETE',
  });
}

export async function listActiveWorkflows(): Promise<{ runs: WorkflowRun[] }> {
  return fetchJson<{ runs: WorkflowRun[] }>(`${API_BASE}/workflows?active=true`);
}

// ---------------------------------------------------------------------------
// Workflow Configuration
// ---------------------------------------------------------------------------

export interface WorkflowParamConfig {
  key: string;
  label: string;
  type: 'text' | 'select';
  default?: string;
  options?: string[];
}

export interface WorkflowConfig {
  showLaunchPanel: boolean;
  params: WorkflowParamConfig[];
  autonomousContext?: string;
  preamble?: string;
  postamble?: string;
}

export type WorkflowConfigMap = Partial<Record<string, WorkflowConfig>>;

export async function fetchWorkflowConfig(): Promise<WorkflowConfigMap> {
  return fetchJson<WorkflowConfigMap>(`${API_BASE}/config/workflows`);
}

// ---------------------------------------------------------------------------
// Per-User Notifications
// ---------------------------------------------------------------------------

export interface NotificationData {
  id: string;
  event: string;
  title: string;
  body: string;
  cardId?: string;
  read: boolean;
  createdAt: string;
}

export async function fetchNotifications(
  unread?: boolean,
): Promise<{ notifications: NotificationData[] }> {
  const params = new URLSearchParams();
  if (unread) params.set('unread', 'true');
  const qs = params.toString() ? `?${params.toString()}` : '';
  return fetchJson<{ notifications: NotificationData[] }>(
    `${API_BASE}/user-notifications${qs}`,
  );
}

export async function fetchUnreadCount(): Promise<{ count: number }> {
  return fetchJson<{ count: number }>(`${API_BASE}/user-notifications/count`);
}

export async function markNotificationRead(id: string): Promise<void> {
  await fetchJson(`${API_BASE}/user-notifications/${encodeURIComponent(id)}/read`, {
    method: 'PUT',
  });
}

export async function markAllNotificationsRead(): Promise<void> {
  await fetchJson(`${API_BASE}/user-notifications/read-all`, {
    method: 'PUT',
  });
}

// ---------------------------------------------------------------------------
// Multi-Repo
// ---------------------------------------------------------------------------

export interface RepoInfo {
  id: string;
  name: string;
}

export async function fetchRepos(): Promise<{ repos: RepoInfo[]; defaultRepo: string }> {
  return fetchJson<{ repos: RepoInfo[]; defaultRepo: string }>(`${API_BASE}/repos`);
}

// ---------------------------------------------------------------------------
// Bulk Operations
// ---------------------------------------------------------------------------

export interface BulkResult {
  id: string;
  success: boolean;
  error?: string;
}

export async function bulkMove(
  cardIds: string[],
  from: string,
  to: string,
  branch?: string,
): Promise<{ results: BulkResult[] }> {
  return fetchJson<{ results: BulkResult[] }>(`${API_BASE}/bulk/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cardIds, from, to, branch }),
  });
}

export async function bulkAssign(
  cardIds: string[],
  claimant: string,
): Promise<{ results: BulkResult[] }> {
  return fetchJson<{ results: BulkResult[] }>(`${API_BASE}/bulk/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cardIds, claimant }),
  });
}

export async function bulkUpdateMetadata(
  cardIds: string[],
  metadata: { labels?: string[]; priority?: string; due?: string },
  branch?: string,
): Promise<{ results: BulkResult[] }> {
  return fetchJson<{ results: BulkResult[] }>(`${API_BASE}/bulk/metadata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cardIds, ...metadata, branch }),
  });
}

export async function bulkDelete(
  cardIds: string[],
  branch?: string,
): Promise<{ results: BulkResult[] }> {
  return fetchJson<{ results: BulkResult[] }>(`${API_BASE}/bulk/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cardIds, branch }),
  });
}

// ---------------------------------------------------------------------------
// Card Relationships
// ---------------------------------------------------------------------------

export interface CardRelationshipsResponse {
  cardId: string;
  parent: string | null;
  children: string[];
  blocks: string[];
  blockedBy: string[];
}

export async function fetchCardRelationships(
  cardId: string,
  branch?: string,
): Promise<CardRelationshipsResponse> {
  const params = branch ? `?branch=${encodeURIComponent(branch)}` : '';
  return fetchJson<CardRelationshipsResponse>(
    `${API_BASE}/cards/${encodeURIComponent(cardId)}/relationships${params}`,
  );
}

export async function updateCardRelationships(
  cardId: string,
  relationships: {
    parent?: string | null;
    children?: string[];
    blocks?: string[];
    blockedBy?: string[];
  },
  branch?: string,
): Promise<{ updated: boolean }> {
  return fetchJson<{ updated: boolean }>(
    `${API_BASE}/cards/${encodeURIComponent(cardId)}/relationships`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...relationships, branch }),
    },
  );
}

export async function detectRelationshipCycles(
  branch?: string,
): Promise<{ hasCycles: boolean; cycleCardIds: string[] }> {
  const params = branch ? `?branch=${encodeURIComponent(branch)}` : '';
  return fetchJson<{ hasCycles: boolean; cycleCardIds: string[] }>(
    `${API_BASE}/relationships/cycles${params}`,
  );
}
