import React, { useState, useMemo } from 'react';
import type { BoardCard, BoardColumn } from '../../shared/grammar/types.js';

const PHASE_DOT_COLORS: Record<string, string> = {
  unclaimed: 'bg-gray-400',
  planning: 'bg-blue-400',
  speccing: 'bg-purple-400',
  implementing: 'bg-yellow-500',
  verifying: 'bg-green-400',
  done: 'bg-emerald-500',
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

interface CalendarViewProps {
  columns: BoardColumn[];
  onCardClick: (card: BoardCard) => void;
}

/** Return YYYY-MM-DD for a Date in local time. */
function toDateKey(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Get all days to display for the calendar grid of a given month. */
function getCalendarDays(year: number, month: number): Date[] {
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);

  // Start from Sunday of the week containing the 1st
  const startDate = new Date(firstOfMonth);
  startDate.setDate(startDate.getDate() - startDate.getDay());

  // End on Saturday of the week containing the last day
  const endDate = new Date(lastOfMonth);
  endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

  const days: Date[] = [];
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const CalendarView: React.FC<CalendarViewProps> = ({ columns, onCardClick }) => {
  const today = new Date();
  const todayKey = toDateKey(today);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  // Flatten all cards from all columns
  const allCards = useMemo(
    () => columns.flatMap((col) => col.cards),
    [columns],
  );

  // Partition cards into dated (by date key) and undated
  const { cardsByDate, undatedCards } = useMemo(() => {
    const byDate = new Map<string, BoardCard[]>();
    const undated: BoardCard[] = [];

    for (const card of allCards) {
      const due = card.metadata?.due;
      if (due) {
        const existing = byDate.get(due);
        if (existing) {
          existing.push(card);
        } else {
          byDate.set(due, [card]);
        }
      } else {
        undated.push(card);
      }
    }

    return { cardsByDate: byDate, undatedCards: undated };
  }, [allCards]);

  const calendarDays = useMemo(
    () => getCalendarDays(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const isOverdue = (dateKey: string): boolean => dateKey < todayKey;

  return (
    <div className="flex gap-4 h-full">
      {/* Calendar grid */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header with month nav */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={goToPrevMonth}
            className="px-3 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm"
            aria-label="Previous month"
          >
            &larr;
          </button>
          <h2 className="text-lg font-semibold text-zinc-100">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </h2>
          <button
            onClick={goToNextMonth}
            className="px-3 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm"
            aria-label="Next month"
          >
            &rarr;
          </button>
        </div>

        {/* Day-of-week header row */}
        <div className="grid grid-cols-7 gap-px mb-px">
          {DAY_LABELS.map((label) => (
            <div
              key={label}
              className="text-center text-xs font-medium text-zinc-400 py-1"
            >
              {label}
            </div>
          ))}
        </div>

        {/* Calendar day cells */}
        <div className="grid grid-cols-7 gap-px flex-1 auto-rows-fr bg-zinc-800 border border-zinc-700 rounded">
          {calendarDays.map((day) => {
            const dateKey = toDateKey(day);
            const isCurrentMonth = day.getMonth() === viewMonth;
            const isToday = dateKey === todayKey;
            const cards = cardsByDate.get(dateKey) ?? [];

            return (
              <div
                key={dateKey}
                className={[
                  'p-1 min-h-[5rem] flex flex-col overflow-hidden',
                  isCurrentMonth ? 'bg-zinc-900' : 'bg-zinc-950',
                  isToday ? 'ring-2 ring-blue-500 ring-inset' : '',
                ].join(' ')}
              >
                <span
                  className={[
                    'text-xs font-medium mb-0.5',
                    isToday
                      ? 'text-blue-400 font-bold'
                      : isCurrentMonth
                        ? 'text-zinc-300'
                        : 'text-zinc-600',
                  ].join(' ')}
                >
                  {day.getDate()}
                </span>
                <div className="flex flex-col gap-0.5 overflow-y-auto">
                  {cards.map((card) => (
                    <CardPill
                      key={card.id}
                      card={card}
                      overdue={isOverdue(dateKey)}
                      onClick={onCardClick}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sidebar: cards without due dates */}
      <div className="w-56 shrink-0 flex flex-col border-l border-zinc-700 pl-4">
        <h3 className="text-sm font-semibold text-zinc-300 mb-2">No due date</h3>
        <div className="flex flex-col gap-1 overflow-y-auto">
          {undatedCards.length === 0 && (
            <span className="text-xs text-zinc-500 italic">None</span>
          )}
          {undatedCards.map((card) => (
            <CardPill
              key={card.id}
              card={card}
              overdue={false}
              onClick={onCardClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Card pill                                                         */
/* ------------------------------------------------------------------ */

interface CardPillProps {
  card: BoardCard;
  overdue: boolean;
  onClick: (card: BoardCard) => void;
}

const CardPill: React.FC<CardPillProps> = ({ card, overdue, onClick }) => {
  const dotColor = PHASE_DOT_COLORS[card.phase] ?? 'bg-gray-400';

  return (
    <button
      type="button"
      onClick={() => onClick(card)}
      className={[
        'flex items-center gap-1 px-1.5 py-0.5 rounded text-left text-xs truncate',
        'hover:brightness-125 transition-colors cursor-pointer',
        overdue
          ? 'bg-red-900/40 text-red-300'
          : 'bg-zinc-800 text-zinc-300',
      ].join(' ')}
      title={card.title}
    >
      <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
      <span className="truncate">{card.title}</span>
    </button>
  );
};

export default CalendarView;
