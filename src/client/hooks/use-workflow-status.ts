/**
 * Workflow Status Hook
 *
 * Polls the workflow status endpoint for a given item ID.
 * Polling is active only when the workflow status is 'running'.
 */

import { useQuery } from '@tanstack/react-query';
import { fetchWorkflowStatus } from '../api.js';

const POLL_INTERVAL_MS = 5_000;

export function useWorkflowStatus(itemId: string | null) {
  return useQuery({
    queryKey: ['workflow', itemId],
    queryFn: () => (itemId ? fetchWorkflowStatus(itemId) : null),
    enabled: !!itemId,
    refetchInterval: (query) => {
      const data = query.state.data;
      // Keep polling only while a workflow is running
      if (data && data.status === 'running') return POLL_INTERVAL_MS;
      return false;
    },
  });
}
