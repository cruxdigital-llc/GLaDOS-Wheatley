/**
 * SSE Hook
 *
 * Subscribes to the server-sent events endpoint for real-time board updates.
 * Falls back to polling (via React Query's refetchInterval) if SSE disconnects.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useSSE() {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (eventSourceRef.current) return;

    try {
      const es = new EventSource('/api/events');
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as { type: string };
          if (data.type === 'board-updated' || data.type === 'sync' || data.type === 'webhook') {
            // Invalidate all board-related queries
            void queryClient.invalidateQueries({ queryKey: ['board'] });
            void queryClient.invalidateQueries({ queryKey: ['repo', 'status'] });
          }
          if (data.type === 'claim' || data.type === 'transition') {
            void queryClient.invalidateQueries({ queryKey: ['board'] });
          }
          if (data.type === 'workflow-prompt' || data.type === 'workflow-done') {
            void queryClient.invalidateQueries({ queryKey: ['workflow-run'] });
            void queryClient.invalidateQueries({ queryKey: ['workflow-output'] });
            void queryClient.invalidateQueries({ queryKey: ['active-workflows'] });
          }
        } catch {
          // Ignore parse errors
        }
      };

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
        // Reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = null;
          connect();
        }, 5_000);
      };
    } catch {
      // SSE not supported — polling via React Query continues
    }
  }, [queryClient]);

  useEffect(() => {
    connect();
    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [connect]);
}
