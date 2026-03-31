/**
 * Claim Mutation Hooks
 *
 * React Query mutations for claiming and releasing board items.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { claimItem, releaseItem } from '../api.js';

export function useClaimItem(branch?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, claimant }: { itemId: string; claimant: string }) =>
      claimItem(itemId, claimant),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['board', branch] });
    },
  });
}

export function useReleaseItem(branch?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, claimant }: { itemId: string; claimant?: string }) =>
      releaseItem(itemId, claimant),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['board', branch] });
    },
  });
}
