/**
 * React Query hook for the activity feed.
 */

import { useQuery } from '@tanstack/react-query';
import { fetchActivityFeed } from '../api.js';
import type { ActivityFeedResponse } from '../api.js';

export function useActivityFeed(
  options?: { limit?: number; actor?: string },
  enabled = true,
) {
  return useQuery<ActivityFeedResponse>({
    queryKey: ['activity', options?.limit, options?.actor],
    queryFn: () => fetchActivityFeed(options),
    refetchInterval: 15_000,
    enabled,
  });
}
