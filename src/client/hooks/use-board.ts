/**
 * Board Data Hooks
 *
 * React Query hooks for fetching board state and card details.
 */

import { useQuery } from '@tanstack/react-query';
import { fetchBoard, fetchCardDetail, fetchBranches } from '../api.js';

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
