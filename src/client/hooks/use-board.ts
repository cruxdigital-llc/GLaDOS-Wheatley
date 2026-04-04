/**
 * Board Data Hooks
 *
 * React Query hooks for fetching board state and card details.
 */

import { useQuery } from '@tanstack/react-query';
import {
  fetchBoard,
  fetchCardDetail,
  fetchBranches,
  fetchConsolidatedBoard,
  fetchBranchHealth,
  fetchRepoStatus,
  fetchGitIdentity,
  fetchConformance,
  type ConsolidatedBoardQuery,
} from '../api.js';

export function useBoard(branch?: string) {
  return useQuery({
    queryKey: ['board', branch],
    queryFn: () => fetchBoard(branch),
    refetchInterval: 30_000, // Auto-refresh every 30s
  });
}

export function useCardDetail(id: string | null, branch?: string) {
  return useQuery({
    queryKey: ['card', id, branch],
    queryFn: () => (id ? fetchCardDetail(id, branch) : null),
    enabled: !!id,
  });
}

export function useBranches() {
  return useQuery({
    queryKey: ['branches'],
    queryFn: fetchBranches,
    staleTime: 60_000, // Branches change infrequently
  });
}

export function useConsolidatedBoard(query?: ConsolidatedBoardQuery, enabled = true) {
  return useQuery({
    queryKey: ['board', 'consolidated', query],
    queryFn: () => fetchConsolidatedBoard(query),
    refetchInterval: 60_000,
    enabled,
  });
}

export function useBranchHealth(base?: string, enabled = true) {
  return useQuery({
    queryKey: ['branches', 'health', base],
    queryFn: () => fetchBranchHealth(base),
    staleTime: 60_000,
    enabled,
  });
}

export function useRepoStatus() {
  return useQuery({
    queryKey: ['repo', 'status'],
    queryFn: fetchRepoStatus,
    refetchInterval: 15_000, // Poll every 15s
  });
}

export function useGitIdentity() {
  return useQuery({
    queryKey: ['identity'],
    queryFn: fetchGitIdentity,
    staleTime: 300_000, // Identity rarely changes — cache 5 min
  });
}

export function useConformance(branch?: string, enabled = true) {
  return useQuery({
    queryKey: ['conformance', branch],
    queryFn: () => fetchConformance(branch),
    staleTime: 120_000, // Re-check conformance every 2 min
    enabled,
  });
}
