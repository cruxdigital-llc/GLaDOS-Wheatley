import React, { useMemo, useState } from 'react';
import type { BoardCard, BoardColumn } from '../../shared/grammar/types.js';
import { phaseDisplayName } from '../../shared/display-names.js';

const PHASE_BAR_COLORS: Record<string, string> = {
  unclaimed: 'bg-gray-400',
  planning: 'bg-blue-400',
  speccing: 'bg-purple-400',
  implementing: 'bg-yellow-500',
  verifying: 'bg-green-400',
  done: 'bg-emerald-500',
};

const PHASE_BADGE_COLORS: Record<string, string> = {
  unclaimed: 'bg-gray-200 text-gray-700',
  planning: 'bg-blue-100 text-blue-700',
  speccing: 'bg-purple-100 text-purple-700',
  implementing: 'bg-yellow-100 text-yellow-700',
  verifying: 'bg-green-100 text-green-700',
  done: 'bg-emerald-100 text-emerald-700',
};

interface TimelineViewProps {
  columns: BoardColumn[];
  onCardClick: (card: BoardCard) => void;
}

/** Parse a date string (YYYY-MM-DD) into a Date, returning null on failure. */
function parseDate(str: string): Date | null {
  const d = new Date(str + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

/** Extract the start date for a card. */
function getCardStartDate(card: BoardCard): Date {
  const now = new Date();

  // 1. Try specEntry.dirName — first 10 chars are YYYY-MM-DD
  if (card.specEntry?.dirName) {
    const dateStr = card.specEntry.dirName.substring(0, 10);
    const parsed = parseDate(dateStr);
    if (parsed) return parsed;
  }

  // 2. Try claim date
  if (card.claim?.claimedAt) {
    const parsed = new Date(card.claim.claimedAt);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  // 3. Fallback to now
  return now;
}

/** Get the end date for a card (today for non-done, or today for done since we lack a completion timestamp). */
function getCardEndDate(card: BoardCard): Date {
  // For done cards with a release date on the claim, use that as the end
  if (card.phase === 'done' && card.claim?.releasedAt) {
    const parsed = new Date(card.claim.releasedAt);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

/** Format a Date as YYYY-MM-DD for display. */
function formatDate(d: Date): string {
  return d.toISOString().substring(0, 10);
}

const ROW_HEIGHT = 40;
const LABEL_WIDTH = 280;
const HEADER_HEIGHT = 48;

export default function TimelineView({ columns, onCardClick }: TimelineViewProps) {
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

  // Flatten all cards from all columns
  const cards = useMemo(
    () => columns.flatMap((col) => col.cards),
    [columns],
  );

  // Compute date ranges and bar positions
  const { timelineStart, timelineEnd, daySpan, cardBars } = useMemo(() => {
    if (cards.length === 0) {
      const now = new Date();
      return { timelineStart: now, timelineEnd: now, daySpan: 1, cardBars: [] };
    }

    const bars = cards.map((card) => ({
      card,
      start: getCardStartDate(card),
      end: getCardEndDate(card),
    }));

    // Find the global min/max dates
    let minDate = bars[0].start;
    let maxDate = bars[0].end;
    for (const bar of bars) {
      if (bar.start < minDate) minDate = bar.start;
      if (bar.end > maxDate) maxDate = bar.end;
    }

    // Add a 1-day padding on each side
    const paddedStart = new Date(minDate);
    paddedStart.setDate(paddedStart.getDate() - 1);
    const paddedEnd = new Date(maxDate);
    paddedEnd.setDate(paddedEnd.getDate() + 1);

    const span = Math.max(
      1,
      Math.ceil(
        (paddedEnd.getTime() - paddedStart.getTime()) / (1000 * 60 * 60 * 24),
      ),
    );

    return {
      timelineStart: paddedStart,
      timelineEnd: paddedEnd,
      daySpan: span,
      cardBars: bars,
    };
  }, [cards]);

  // Generate tick marks for the X-axis
  const ticks = useMemo(() => {
    const result: { label: string; pct: number }[] = [];
    if (daySpan <= 0) return result;

    // Decide tick interval based on span
    let intervalDays = 1;
    if (daySpan > 120) intervalDays = 14;
    else if (daySpan > 60) intervalDays = 7;
    else if (daySpan > 14) intervalDays = 3;

    const cursor = new Date(timelineStart);
    while (cursor <= timelineEnd) {
      const dayOffset =
        (cursor.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24);
      const pct = (dayOffset / daySpan) * 100;
      result.push({ label: formatDate(cursor), pct });
      cursor.setDate(cursor.getDate() + intervalDays);
    }
    return result;
  }, [timelineStart, timelineEnd, daySpan]);

  if (cards.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500 text-sm">
        No cards to display on the timeline.
      </div>
    );
  }

  const totalHeight = HEADER_HEIGHT + cards.length * ROW_HEIGHT + 32;

  return (
    <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
      <div
        className="relative"
        style={{ minWidth: 800, height: totalHeight }}
      >
        {/* ---- X-Axis Header ---- */}
        <div
          className="sticky top-0 z-10 flex bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
          style={{ height: HEADER_HEIGHT }}
        >
          {/* Label column header */}
          <div
            className="shrink-0 flex items-center px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide border-r border-gray-200 dark:border-gray-700"
            style={{ width: LABEL_WIDTH }}
          >
            Card
          </div>

          {/* Timeline header with tick labels */}
          <div className="relative flex-1">
            {ticks.map((tick, i) => (
              <div
                key={i}
                className="absolute top-0 flex flex-col items-center"
                style={{ left: `${tick.pct}%`, height: HEADER_HEIGHT }}
              >
                <div className="h-full w-px bg-gray-200" />
                <span className="absolute bottom-1 text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap -translate-x-1/2">
                  {tick.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ---- Rows ---- */}
        {cardBars.map(({ card, start, end }, index) => {
          const startOffset =
            (start.getTime() - timelineStart.getTime()) /
            (1000 * 60 * 60 * 24);
          const endOffset =
            (end.getTime() - timelineStart.getTime()) /
            (1000 * 60 * 60 * 24);
          const leftPct = (startOffset / daySpan) * 100;
          const widthPct = Math.max(
            0.5,
            ((endOffset - startOffset) / daySpan) * 100,
          );

          const barColor =
            PHASE_BAR_COLORS[card.phase] ?? 'bg-gray-400';
          const badgeColor =
            PHASE_BADGE_COLORS[card.phase] ?? 'bg-gray-200 text-gray-700';
          const isHovered = hoveredCardId === card.id;

          return (
            <div
              key={card.id}
              className={`flex border-b border-gray-100 dark:border-gray-700 ${
                isHovered ? 'bg-gray-50 dark:bg-gray-800' : ''
              }`}
              style={{
                height: ROW_HEIGHT,
                position: 'absolute',
                top: HEADER_HEIGHT + index * ROW_HEIGHT,
                left: 0,
                right: 0,
              }}
            >
              {/* Label */}
              <div
                className="shrink-0 flex items-center gap-2 px-3 border-r border-gray-200 dark:border-gray-700 overflow-hidden"
                style={{ width: LABEL_WIDTH }}
              >
                <span className="truncate text-sm text-gray-700 dark:text-gray-300">
                  {card.title}
                </span>
                <span
                  className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${badgeColor}`}
                >
                  {phaseDisplayName(card.phase)}
                </span>
              </div>

              {/* Bar area */}
              <div className="relative flex-1">
                {/* Vertical grid lines */}
                {ticks.map((tick, i) => (
                  <div
                    key={i}
                    className="absolute top-0 h-full w-px bg-gray-100"
                    style={{ left: `${tick.pct}%` }}
                  />
                ))}

                {/* The bar itself */}
                <button
                  type="button"
                  className={`absolute top-1.5 h-6 rounded cursor-pointer transition-opacity ${barColor} ${
                    isHovered ? 'opacity-100 ring-2 ring-offset-1 ring-gray-400' : 'opacity-80'
                  }`}
                  style={{
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                    minWidth: 6,
                  }}
                  title={`${card.title} (${card.phase})\n${formatDate(start)} \u2192 ${formatDate(end)}`}
                  onClick={() => onCardClick(card)}
                  onMouseEnter={() => setHoveredCardId(card.id)}
                  onMouseLeave={() => setHoveredCardId(null)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
