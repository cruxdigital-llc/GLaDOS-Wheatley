/**
 * API Client
 *
 * Typed HTTP client for the Wheatley backend.
 */

import type { BoardState, ClaimEntry } from '../shared/grammar/types.js';

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
