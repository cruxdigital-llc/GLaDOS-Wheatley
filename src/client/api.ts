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

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchBoard(branch?: string): Promise<BoardState> {
  const params = branch ? `?branch=${encodeURIComponent(branch)}` : '';
  return fetchJson<BoardState>(`${API_BASE}/board${params}`);
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
}

export async function executeTransition(
  itemId: string,
  from: string,
  to: string,
  branch?: string,
): Promise<void> {
  const body: TransitionRequest = { itemId, from, to };
  if (branch) body.branch = branch;

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
}

export async function fetchRepoStatus(): Promise<RepoStatusResponse> {
  return fetchJson<RepoStatusResponse>(`${API_BASE}/repo/status`);
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
