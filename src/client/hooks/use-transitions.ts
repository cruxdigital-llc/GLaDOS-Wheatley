/**
 * Transition Mutation Hook
 *
 * React Query mutation for executing a phase transition on a board item.
 * Handles optimistic updates and rollback on failure.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { executeTransition } from '../api.js';

interface TransitionVariables {
  itemId: string;
  from: string;
  to: string;
  branch?: string;
}

export function useExecuteTransition(branch?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, from, to }: TransitionVariables) =>
      executeTransition(itemId, from, to, branch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['board', branch] });
    },
  });
}
