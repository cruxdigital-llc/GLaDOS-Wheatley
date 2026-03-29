/**
 * API Client
 *
 * Typed HTTP client for the Wheatley backend.
 */

import type { BoardState } from '../shared/grammar/types.js';

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
