/**
 * Card Timeline Component
 *
 * Shows a visual history of a card's lifecycle: creation date,
 * current phase, claim status, and completion state.
 */

import React from 'react';
import { useCardDetail } from '../hooks/use-board.js';
import type { RoadmapItem, ClaimEntry } from '../../shared/grammar/types.js';

interface CardTimelineProps {
  cardId: string;
  branch?: string;
}

interface TimelineEvent {
  label: string;
  detail: string;
  color: string;
}

const PHASE_COLORS: Record<string, string> = {
  unclaimed: 'bg-gray-400',
  planning: 'bg-blue-400',
  speccing: 'bg-purple-400',
  implementing: 'bg-yellow-400',
  verifying: 'bg-orange-400',
  done: 'bg-green-400',
};

/**
 * The server returns a full BoardCard but the client CardDetailResponse type
 * is narrower. We safely access optional fields that may exist on the
 * actual server response.
 */
interface ExtendedCard {
  id: string;
  title: string;
  phase: string;
  source: string;
  specEntry?: { dirName: string; files: string[] };
  roadmapItem?: RoadmapItem;
  claim?: ClaimEntry;
}

export function CardTimeline({ cardId, branch }: CardTimelineProps) {
  const { data: detail } = useCardDetail(cardId, branch);

  if (!detail) return null;

  const card = detail.card as ExtendedCard;
  const events: TimelineEvent[] = [];

  // Extract creation date from spec dir name (YYYY-MM-DD prefix)
  const specDir = card.specEntry?.dirName;
  if (specDir) {
    const dateMatch = specDir.match(/^(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      events.push({
        label: 'Created',
        detail: dateMatch[1],
        color: 'bg-gray-400',
      });
    }
  }

  // Roadmap item completion
  if (card.roadmapItem) {
    if (card.roadmapItem.completed) {
      events.push({
        label: 'Roadmap item completed',
        detail: `${card.roadmapItem.phaseTitle} - ${card.roadmapItem.sectionTitle}`,
        color: 'bg-green-400',
      });
    } else {
      events.push({
        label: 'Roadmap item open',
        detail: `${card.roadmapItem.phaseTitle} - ${card.roadmapItem.sectionTitle}`,
        color: 'bg-gray-300',
      });
    }
  }

  // Claim status
  if (card.claim) {
    events.push({
      label: `Claimed by ${card.claim.claimant}`,
      detail: new Date(card.claim.claimedAt).toLocaleDateString(),
      color: 'bg-blue-400',
    });
  }

  // Current phase
  events.push({
    label: 'Current phase',
    detail: card.phase.charAt(0).toUpperCase() + card.phase.slice(1),
    color: PHASE_COLORS[card.phase] ?? 'bg-gray-400',
  });

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Timeline</h3>
      <div className="relative pl-4">
        {/* Vertical line */}
        <div className="absolute left-[7px] top-1 bottom-1 w-0.5 bg-gray-200" />

        <div className="space-y-3">
          {events.map((event, idx) => (
            <div key={idx} className="relative flex items-start gap-3">
              {/* Dot */}
              <div
                className={`absolute -left-4 top-1 w-3 h-3 rounded-full border-2 border-white ${event.color}`}
              />
              {/* Content */}
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-700">{event.label}</p>
                <p className="text-xs text-gray-500 truncate">{event.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
